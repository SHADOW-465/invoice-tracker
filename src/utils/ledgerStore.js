/**
 * One ledger interface, two backings.
 *
 *   Desktop (Electron) -> SQLite in the main process, over IPC.
 *   Browser (dev/preview) -> localStorage, with the quarantine + mirror safety net.
 *
 * Screens and the store never branch on which one is active. Keeping a single
 * contract is deliberate: the last time this app had two parallel implementations
 * of one rule they drifted apart and produced wrong numbers.
 */
import {
  STORAGE_KEYS,
  safeRead,
  safeWrite,
  isValidWorkspaces,
  quarantine,
  mirrorWrite,
  estimateUsage
} from "./storage";
import { INITIAL_INVOICES, INITIAL_CLIENTS } from "../types/finance";

export const isDesktop = () =>
  typeof window !== "undefined" && !!window.ledgerAPI && window.ledgerAPI.available === true;

export const backendName = () => (isDesktop() ? "sqlite" : "localstorage");

const freshWorkspace = (invoices = []) => ([
  { id: "default", name: "Master Ledger", invoices, createdAt: new Date().toISOString() }
]);

/** Unwrap the { ok, data } envelope every IPC handler returns. */
function unwrap(res, what) {
  if (!res) throw new Error(`No response from the database while ${what}`);
  if (!res.ok) throw Object.assign(new Error(res.error || `Database error while ${what}`), { code: res.code });
  return res.data;
}

/* ------------------------------------------------------------------- load */

/**
 * @returns {{workspaces, clients, settings, storage, migration?}}
 * `storage` mirrors the shape StorageGuard already understands, so a database
 * failure is explained with the same guided card as a browser-storage failure.
 */
export async function loadLedger() {
  if (isDesktop()) return loadFromSqlite();
  return loadFromLocalStorage();
}

async function loadFromSqlite() {
  let data;
  try {
    data = unwrap(await window.ledgerAPI.readAll(), "opening the ledger");
  } catch (error) {
    return {
      workspaces: freshWorkspace([]),
      clients: [],
      settings: {},
      storage: { status: "unavailable", detail: error.message }
    };
  }

  let migration = null;

  // A first run after upgrading: the database is empty but the old browser copy
  // may still be sitting there. Move it across once, then leave it alone.
  const empty = data.workspaces.every((w) => !w.invoices || w.invoices.length === 0);
  if (empty) {
    const legacy = readLegacyBrowserLedger();
    if (legacy) {
      try {
        migration = unwrap(
          await window.ledgerAPI.migrateFromLocalStorage(legacy),
          "importing your existing ledger"
        );
        if (migration && migration.migrated) {
          data = unwrap(await window.ledgerAPI.readAll(), "reloading after import");
        }
      } catch (error) {
        // Migration failing is not fatal - the old data is untouched and can be
        // retried on the next launch.
        migration = { migrated: false, error: error.message };
      }
    }
  }

  return {
    workspaces: data.workspaces.length ? data.workspaces : freshWorkspace([]),
    clients: data.clients || [],
    settings: data.settings || {},
    dbPath: data.dbPath,
    storage: { status: "ok" },
    migration
  };
}

/** Read the old browser ledger without disturbing it. */
function readLegacyBrowserLedger() {
  const read = safeRead(STORAGE_KEYS.WORKSPACES, isValidWorkspaces);
  if (read.status !== "ok") return null;
  const hasInvoices = read.value.some((w) => Array.isArray(w.invoices) && w.invoices.length > 0);
  if (!hasInvoices) return null;

  const clientsRead = safeRead(STORAGE_KEYS.CLIENTS);
  const settingsRead = safeRead(STORAGE_KEYS.SETTINGS);
  return {
    workspaces: read.value,
    clients: clientsRead.status === "ok" ? clientsRead.value : [],
    settings: settingsRead.status === "ok" ? settingsRead.value : {}
  };
}

function loadFromLocalStorage() {
  const read = safeRead(STORAGE_KEYS.WORKSPACES, isValidWorkspaces);

  if (read.status === "ok") {
    return {
      workspaces: read.value,
      clients: pick(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS),
      settings: pick(STORAGE_KEYS.SETTINGS, {}),
      storage: { status: "ok" }
    };
  }

  if (read.status === "corrupt") {
    const quarantineKey = quarantine(STORAGE_KEYS.WORKSPACES, read.raw);
    return {
      workspaces: freshWorkspace([]),
      clients: [],
      settings: {},
      storage: {
        status: "corrupt",
        quarantineKey,
        rawBytes: read.raw ? read.raw.length : 0,
        detail: read.error ? read.error.message : "Saved data could not be read"
      }
    };
  }

  if (read.status === "unavailable") {
    return {
      workspaces: freshWorkspace([]),
      clients: [],
      settings: {},
      storage: { status: "unavailable", detail: read.error ? read.error.message : "Storage unavailable" }
    };
  }

  return {
    workspaces: freshWorkspace(INITIAL_INVOICES),
    clients: INITIAL_CLIENTS,
    settings: {},
    storage: { status: "ok" }
  };
}

function pick(key, fallback) {
  const r = safeRead(key);
  return r.status === "ok" ? r.value : fallback;
}

/* ------------------------------------------------------------------ write */

/**
 * Persist a set of invoice changes.
 *
 * On SQLite this is a transaction touching only the changed rows. On localStorage
 * there is no such thing as a partial write, so the whole blob still goes out -
 * which is exactly the limitation the desktop build now escapes.
 */
export async function persistInvoiceChanges(workspaceId, changes, wholeWorkspaces) {
  if (isDesktop()) {
    try {
      unwrap(await window.ledgerAPI.applyInvoiceChanges(workspaceId, changes), "saving invoices");
      return { ok: true };
    } catch (error) {
      return { ok: false, kind: classify(error), detail: error.message };
    }
  }
  return persistBlob(wholeWorkspaces);
}

export async function persistReplaceInvoices(workspaceId, invoices, wholeWorkspaces) {
  if (isDesktop()) {
    try {
      unwrap(await window.ledgerAPI.replaceInvoices(workspaceId, invoices), "replacing the ledger");
      return { ok: true };
    } catch (error) {
      return { ok: false, kind: classify(error), detail: error.message };
    }
  }
  return persistBlob(wholeWorkspaces);
}

export async function persistWorkspaceMeta(workspaces) {
  if (isDesktop()) {
    try {
      unwrap(await window.ledgerAPI.saveWorkspaceMeta(
        workspaces.map((w) => ({ id: w.id, name: w.name, createdAt: w.createdAt }))
      ), "saving ledger names");
      return { ok: true };
    } catch (error) {
      return { ok: false, kind: classify(error), detail: error.message };
    }
  }
  return persistBlob(workspaces);
}

export async function removeWorkspace(id) {
  if (isDesktop()) {
    try {
      unwrap(await window.ledgerAPI.deleteWorkspace(id), "deleting the ledger");
      return { ok: true };
    } catch (error) {
      return { ok: false, kind: classify(error), detail: error.message };
    }
  }
  return { ok: true };
}

export async function persistClients(clients) {
  if (isDesktop()) {
    try {
      unwrap(await window.ledgerAPI.saveClients(clients), "saving clients");
      return { ok: true };
    } catch (error) {
      return { ok: false, kind: classify(error), detail: error.message };
    }
  }
  const r = safeWrite(STORAGE_KEYS.CLIENTS, clients);
  return r.ok ? { ok: true } : { ok: false, kind: r.kind, detail: r.error?.message };
}

export async function persistSettings(settings) {
  if (isDesktop()) {
    try {
      unwrap(await window.ledgerAPI.saveSettings(settings), "saving settings");
      return { ok: true };
    } catch (error) {
      return { ok: false, kind: classify(error), detail: error.message };
    }
  }
  const r = safeWrite(STORAGE_KEYS.SETTINGS, settings);
  return r.ok ? { ok: true } : { ok: false, kind: r.kind, detail: r.error?.message };
}

/** Browser-only whole-ledger write, kept behind the same result contract. */
function persistBlob(workspaces) {
  const result = safeWrite(STORAGE_KEYS.WORKSPACES, workspaces);
  if (result.ok) {
    mirrorWrite(STORAGE_KEYS.WORKSPACES, workspaces);
    return { ok: true };
  }
  mirrorWrite(STORAGE_KEYS.WORKSPACES, workspaces);
  return {
    ok: false,
    kind: result.kind,
    detail: result.error ? result.error.message : "Unknown storage error",
    attemptedBytes: result.bytes || 0,
    usageBytes: estimateUsage()
  };
}

function classify(error) {
  const msg = String(error?.message || "").toLowerCase();
  if (msg.includes("unique constraint")) return "duplicate";
  if (msg.includes("disk") || msg.includes("full") || msg.includes("space")) return "quota";
  if (msg.includes("readonly") || msg.includes("permission") || msg.includes("locked")) return "unavailable";
  return "unknown";
}

/* ---------------------------------------------------------------- backups */

export async function makeBackup(reason = "manual") {
  if (!isDesktop()) return { ok: false, detail: "Backups need the desktop app" };
  try {
    return { ok: true, data: unwrap(await window.ledgerAPI.backup(reason), "creating a backup") };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

export async function listBackups() {
  if (!isDesktop()) return [];
  try {
    return unwrap(await window.ledgerAPI.listBackups(), "listing backups") || [];
  } catch {
    return [];
  }
}

export async function restoreBackup(path) {
  if (!isDesktop()) return { ok: false, detail: "Backups need the desktop app" };
  try {
    return { ok: true, data: unwrap(await window.ledgerAPI.restoreBackup(path), "restoring the backup") };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}

export async function revealBackups() {
  if (!isDesktop()) return;
  try { await window.ledgerAPI.revealBackups(); } catch { /* ignore */ }
}

export async function ledgerStats() {
  if (!isDesktop()) return null;
  try {
    return unwrap(await window.ledgerAPI.stats(), "reading database stats");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ diff */

const fingerprint = (inv) => JSON.stringify([
  inv.invoiceNo, inv.clientName, inv.amount, inv.currency, inv.paymentMode,
  inv.raisedOn, inv.invoicedMonth, inv.status, inv.receivedOn, inv.paymentTerms,
  inv.dueDate, inv.taxRate, inv.taxAmount, inv.netReceived, inv.remarks
]);

/** Build a fingerprint map so later saves only send rows that actually changed. */
export function snapshotInvoices(invoices = []) {
  const map = new Map();
  for (const inv of invoices) map.set(inv.id, fingerprint(inv));
  return map;
}

/** Compare current invoices against the last persisted snapshot. */
export function diffInvoices(previous, current = []) {
  const upserts = [];
  const seen = new Set();

  for (const inv of current) {
    seen.add(inv.id);
    const before = previous.get(inv.id);
    if (before === undefined || before !== fingerprint(inv)) upserts.push(inv);
  }

  const deletes = [];
  for (const id of previous.keys()) if (!seen.has(id)) deletes.push(id);

  return { upserts, deletes, changed: upserts.length > 0 || deletes.length > 0 };
}
