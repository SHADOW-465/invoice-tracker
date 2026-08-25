/**
 * Resilient storage layer for the ledger.
 *
 * The rules this file exists to enforce:
 *
 *  1. NEVER destroy data we failed to read. If the stored JSON is damaged we
 *     quarantine the raw bytes and refuse to write anything until the user has
 *     decided what to do. Previously a damaged read silently fell back to demo
 *     data, which was then written straight over the damaged original.
 *  2. Writes never throw. They return a typed result the UI can explain.
 *  3. Keep a second copy in IndexedDB. It has a far larger quota than
 *     localStorage and fails independently, so it can recover a bad primary.
 */

export const STORAGE_KEYS = {
  INVOICES: "apex_finance_invoices_v1",
  WORKSPACES: "apex_finance_workspaces_v1",
  ACTIVE_WORKSPACE: "apex_finance_active_workspace_v1",
  CLIENTS: "apex_finance_clients_v1",
  SETTINGS: "apex_finance_settings_v1",
  THEME: "apex_finance_theme_v1",
  BASE_CURRENCY: "apex_finance_base_currency_v1",
  LAST_BACKUP: "apex_finance_last_backup_v1"
};

const QUARANTINE_PREFIX = "apex_finance_QUARANTINE_";

/* ------------------------------------------------------------------ reading */

/**
 * Read and parse a key.
 * @returns {{status:'ok'|'empty'|'corrupt'|'unavailable', value?:any, raw?:string, error?:Error}}
 */
export function safeRead(key, validate) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    // Private browsing, disabled storage, or a locked profile.
    return { status: "unavailable", error };
  }

  if (raw === null || raw === "") return { status: "empty" };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "corrupt", raw, error };
  }

  // Parsed but structurally wrong is just as dangerous as unparseable - it would
  // render as an empty ledger and then be saved over the top of the real one.
  if (typeof validate === "function" && !validate(parsed)) {
    return { status: "corrupt", raw, error: new Error("Stored data has an unexpected shape") };
  }

  return { status: "ok", value: parsed, raw };
}

/** Shape check for the workspaces payload - the ledger itself. */
export function isValidWorkspaces(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((w) => w && typeof w === "object" && typeof w.id === "string" && Array.isArray(w.invoices))
  );
}

/* ------------------------------------------------------------------ writing */

/**
 * Write a value. Never throws.
 * @returns {{ok:true, bytes:number} | {ok:false, kind:'quota'|'unavailable'|'unknown', error:Error, bytes?:number}}
 */
export function safeWrite(key, value) {
  let payload;
  try {
    payload = JSON.stringify(value);
  } catch (error) {
    return { ok: false, kind: "unknown", error };
  }

  try {
    localStorage.setItem(key, payload);
    return { ok: true, bytes: payload.length };
  } catch (error) {
    return { ok: false, kind: classifyWriteError(error), error, bytes: payload.length };
  }
}

function classifyWriteError(error) {
  if (!error) return "unknown";
  // Browsers disagree on the name/code for a full quota.
  const quota =
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014;
  if (quota) return "quota";
  if (error.name === "SecurityError" || error.name === "InvalidAccessError") return "unavailable";
  return "unknown";
}

/** Roughly how much of the localStorage budget the app is using, in bytes. */
export function estimateUsage() {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      total += k.length + (localStorage.getItem(k) || "").length;
    }
    return total;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------- quarantine */

/**
 * Move damaged bytes somewhere safe so the user can still recover from them.
 * Returns the quarantine key, or null if even this could not be written.
 */
export function quarantine(key, raw) {
  if (!raw) return null;
  const qKey = `${QUARANTINE_PREFIX}${key}_${Date.now()}`;
  try {
    localStorage.setItem(qKey, raw);
    return qKey;
  } catch {
    // Quarantining a large damaged blob can itself exceed quota. The blob is
    // still in its original key, which we will refuse to overwrite.
    return null;
  }
}

export function listQuarantined() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(QUARANTINE_PREFIX)) {
        const raw = localStorage.getItem(k) || "";
        out.push({ key: k, bytes: raw.length, savedAt: Number(k.split("_").pop()) || null });
      }
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export function readQuarantined(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function clearQuarantined(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Salvage whatever invoice objects can still be read out of a damaged blob.
 *
 * A truncated write usually leaves most records intact and only mangles the tail,
 * so scanning for complete objects recovers nearly everything.
 */
export function salvageInvoices(raw) {
  if (!raw || typeof raw !== "string") return [];
  const found = [];
  const seen = new Set();

  // Match balanced-looking record objects that carry an invoice number.
  const re = /\{[^{}]*"invoiceNo"\s*:\s*"[^"]*"[^{}]*\}/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    try {
      const obj = JSON.parse(m[0]);
      const key = String(obj.invoiceNo || "").toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        found.push(obj);
      }
    } catch {
      /* skip the record that got cut in half */
    }
  }
  return found;
}

/* ------------------------------------------------ IndexedDB recovery mirror */

const DB_NAME = "apex_finance_mirror";
const DB_STORE = "ledger";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

/** Best-effort second copy. Failure here is never fatal. */
export async function mirrorWrite(key, value) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put({ savedAt: Date.now(), value }, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function mirrorRead(key) {
  try {
    const db = await openDB();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record || null;
  } catch {
    return null;
  }
}
