/**
 * SQLite ledger store.
 *
 * Uses node:sqlite, which ships inside Electron's bundled Node - no native module,
 * no electron-rebuild, nothing extra for the packaging pipeline to handle.
 *
 * Why this replaces the localStorage blob:
 *   - A partial write can no longer corrupt the whole ledger. Each change is a
 *     transaction; a crash rolls it back instead of truncating one giant JSON string.
 *   - No 5MB quota. The ledger is a file on disk.
 *   - Invoice-number uniqueness is enforced by the database, not by a UI check that
 *     an import can bypass.
 */

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

let db = null;
let dbPath = null;
let backupDir = null;

/* ------------------------------------------------------------------ schema */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL,
  invoice_no     TEXT NOT NULL,
  client_name    TEXT,
  amount         REAL    DEFAULT 0,
  currency       TEXT    DEFAULT 'USD',
  payment_mode   TEXT,
  raised_on      TEXT,
  invoiced_month TEXT,
  status         TEXT    DEFAULT 'Pending',
  received_on    TEXT,
  payment_terms  TEXT,
  due_date       TEXT,
  tax_rate       REAL    DEFAULT 0,
  tax_amount     REAL    DEFAULT 0,
  net_received   REAL    DEFAULT 0,
  remarks        TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invoices_raised    ON invoices(raised_on);
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON invoices(status);

/* An invoice number identifies the record. Enforcing it here means an import
   cannot quietly collapse two invoices into one the way merge-by-number did. */
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_no_unique
  ON invoices(workspace_id, lower(invoice_no));

CREATE TABLE IF NOT EXISTS clients (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  contact_person   TEXT,
  email            TEXT,
  default_currency TEXT,
  default_terms    TEXT,
  notes            TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_name_unique ON clients(lower(name));

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS change_events (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  action        TEXT NOT NULL,
  invoice_id    TEXT,
  invoice_no    TEXT,
  client_name   TEXT,
  summary       TEXT NOT NULL,
  before_json   TEXT,
  after_json    TEXT,
  batch_id      TEXT,
  undone        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_change_events_ws_time
  ON change_events(workspace_id, created_at DESC);
`;

/* ------------------------------------------------------------------- open */

function init(userDataPath) {
  dbPath = path.join(userDataPath, "ledger.db");
  backupDir = path.join(userDataPath, "backups");
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  db = new DatabaseSync(dbPath);

  // WAL keeps readers working during a write and makes crash recovery the
  // database's job rather than ours.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec(SCHEMA);
  ensureChangeEventColumns();

  return { path: dbPath, backupDir };
}

function ensureChangeEventColumns() {
  const cols = db.prepare("PRAGMA table_info(change_events)").all().map((c) => c.name);
  if (!cols.includes("undone")) {
    db.exec("ALTER TABLE change_events ADD COLUMN undone INTEGER NOT NULL DEFAULT 0");
  }
}

const isReady = () => db !== null;

/* ------------------------------------------------------------- row mapping */

const toInvoice = (r) => ({
  id: r.id,
  invoiceNo: r.invoice_no,
  clientName: r.client_name || "",
  amount: r.amount || 0,
  currency: r.currency || "USD",
  paymentMode: r.payment_mode || "Online",
  raisedOn: r.raised_on || "",
  invoicedMonth: r.invoiced_month || "",
  status: r.status || "Pending",
  receivedOn: r.received_on || "",
  paymentTerms: r.payment_terms || "Net 30",
  dueDate: r.due_date || "",
  taxRate: r.tax_rate || 0,
  taxAmount: r.tax_amount || 0,
  netReceived: r.net_received || 0,
  remarks: r.remarks || ""
});

const invoiceParams = (wsId, i) => ({
  id: String(i.id),
  workspace_id: String(wsId),
  invoice_no: String(i.invoiceNo || "").trim(),
  client_name: String(i.clientName || ""),
  amount: Number(i.amount) || 0,
  currency: String(i.currency || "USD"),
  payment_mode: String(i.paymentMode || "Online"),
  raised_on: String(i.raisedOn || ""),
  invoiced_month: String(i.invoicedMonth || ""),
  status: String(i.status || "Pending"),
  received_on: String(i.receivedOn || ""),
  payment_terms: String(i.paymentTerms || "Net 30"),
  due_date: String(i.dueDate || ""),
  tax_rate: Number(i.taxRate) || 0,
  tax_amount: Number(i.taxAmount) || 0,
  net_received: Number(i.netReceived) || 0,
  remarks: String(i.remarks || "")
});

const UPSERT_INVOICE = `
INSERT INTO invoices (
  id, workspace_id, invoice_no, client_name, amount, currency, payment_mode,
  raised_on, invoiced_month, status, received_on, payment_terms, due_date,
  tax_rate, tax_amount, net_received, remarks
) VALUES (
  $id, $workspace_id, $invoice_no, $client_name, $amount, $currency, $payment_mode,
  $raised_on, $invoiced_month, $status, $received_on, $payment_terms, $due_date,
  $tax_rate, $tax_amount, $net_received, $remarks
)
ON CONFLICT(id) DO UPDATE SET
  workspace_id=excluded.workspace_id, invoice_no=excluded.invoice_no,
  client_name=excluded.client_name, amount=excluded.amount, currency=excluded.currency,
  payment_mode=excluded.payment_mode, raised_on=excluded.raised_on,
  invoiced_month=excluded.invoiced_month, status=excluded.status,
  received_on=excluded.received_on, payment_terms=excluded.payment_terms,
  due_date=excluded.due_date, tax_rate=excluded.tax_rate,
  tax_amount=excluded.tax_amount, net_received=excluded.net_received,
  remarks=excluded.remarks
`;

/* ------------------------------------------------------------------ read */

function readAll() {
  const workspaces = db.prepare("SELECT * FROM workspaces ORDER BY created_at").all();

  if (workspaces.length === 0) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)")
      .run("default", "Master Ledger", now);
    workspaces.push({ id: "default", name: "Master Ledger", created_at: now });
  }

  const stmt = db.prepare("SELECT * FROM invoices WHERE workspace_id = ? ORDER BY raised_on DESC");

  const shaped = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    createdAt: w.created_at,
    invoices: stmt.all(w.id).map(toInvoice)
  }));

  const clients = db.prepare("SELECT * FROM clients ORDER BY name").all().map((c) => ({
    id: c.id,
    name: c.name,
    contactPerson: c.contact_person || "",
    email: c.email || "",
    defaultCurrency: c.default_currency || "USD",
    defaultTerms: c.default_terms || "Net 30",
    notes: c.notes || ""
  }));

  const settings = {};
  for (const row of db.prepare("SELECT key,value FROM settings").all()) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }

  return { workspaces: shaped, clients, settings, dbPath };
}

/* ----------------------------------------------------------------- write */

/**
 * Apply a set of invoice changes atomically.
 *
 * The renderer sends only what actually changed, so a status flip writes one row
 * instead of rewriting the entire ledger the way the JSON blob had to.
 */
function applyInvoiceChanges(workspaceId, { upserts = [], deletes = [] }) {
  ensureWorkspace(workspaceId);

  const up = db.prepare(UPSERT_INVOICE);
  const del = db.prepare("DELETE FROM invoices WHERE id = ? AND workspace_id = ?");

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const id of deletes) del.run(String(id), String(workspaceId));
    for (const inv of upserts) up.run(invoiceParams(workspaceId, inv));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  return { upserted: upserts.length, deleted: deletes.length };
}

/** Replace a workspace's invoices wholesale - used by import "replace" mode. */
function replaceInvoices(workspaceId, invoices) {
  ensureWorkspace(workspaceId);
  const up = db.prepare(UPSERT_INVOICE);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM invoices WHERE workspace_id = ?").run(String(workspaceId));
    for (const inv of invoices) up.run(invoiceParams(workspaceId, inv));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { count: invoices.length };
}

function ensureWorkspace(id) {
  const found = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(String(id));
  if (!found) {
    db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)")
      .run(String(id), "Master Ledger", new Date().toISOString());
  }
}

function saveWorkspaceMeta(list) {
  const up = db.prepare(`
    INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const w of list) up.run(String(w.id), String(w.name || "Untitled"), w.createdAt || new Date().toISOString());
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function deleteWorkspace(id) {
  db.prepare("DELETE FROM workspaces WHERE id = ?").run(String(id));
  return { ok: true };
}

function saveClients(clients) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM clients").run();
    const up = db.prepare(`
      INSERT INTO clients (id,name,contact_person,email,default_currency,default_terms,notes)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO NOTHING
    `);
    const seen = new Set();
    for (const c of clients) {
      const name = String(c.name || "").trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      up.run(
        String(c.id || `c-${name.replace(/\s+/g, "_")}`),
        name,
        String(c.contactPerson || ""),
        String(c.email || ""),
        String(c.defaultCurrency || ""),
        String(c.defaultTerms || ""),
        String(c.notes || "")
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function saveSettings(settings) {
  const up = db.prepare(`
    INSERT INTO settings (key,value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [k, v] of Object.entries(settings || {})) up.run(k, JSON.stringify(v));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/* -------------------------------------------------------------- migration */

const getMeta = (k) => {
  const r = db.prepare("SELECT value FROM meta WHERE key = ?").get(k);
  return r ? r.value : null;
};
const setMeta = (k, v) => {
  db.prepare("INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, String(v));
};

/**
 * One-time import of the old browser-storage ledger.
 *
 * Runs only when the database has no invoices at all, so it can never overwrite a
 * populated database if the renderer still has stale localStorage lying around.
 */
function migrateFromLocalStorage(payload) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM invoices").get().n;
  if (existing > 0) return { migrated: false, reason: "database already has invoices", existing };
  if (getMeta("migrated_from_localstorage")) return { migrated: false, reason: "already migrated" };

  const { workspaces = [], clients = [], settings = {} } = payload || {};
  const usable = workspaces.filter((w) => w && Array.isArray(w.invoices));
  if (!usable.length) return { migrated: false, reason: "nothing to migrate" };

  let total = 0;
  let skipped = 0;

  for (const w of usable) {
    const id = String(w.id || "default");
    db.prepare(`
      INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name
    `).run(id, String(w.name || "Master Ledger"), w.createdAt || new Date().toISOString());

    const up = db.prepare(UPSERT_INVOICE);
    db.exec("BEGIN IMMEDIATE");
    try {
      const seen = new Set();
      for (const inv of w.invoices) {
        const no = String(inv.invoiceNo || "").trim().toLowerCase();
        // The unique index would reject a repeat; count it rather than abort the
        // whole migration over a duplicate that already existed in the old data.
        if (!no || seen.has(no)) { skipped++; continue; }
        seen.add(no);
        up.run(invoiceParams(id, { ...inv, id: inv.id || `inv-${no}-${total}` }));
        total++;
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }

  if (clients.length) saveClients(clients);
  if (settings && Object.keys(settings).length) saveSettings(settings);

  setMeta("migrated_from_localstorage", new Date().toISOString());
  return { migrated: true, invoices: total, skippedDuplicates: skipped, workspaces: usable.length };
}

/* ---------------------------------------------------------------- backups */

/**
 * Snapshot the database file. SQLite's own backup API copies a consistent image
 * even while the app is mid-write.
 */
function backup(reason = "auto") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const target = path.join(backupDir, `ledger-${stamp}-${reason}.db`);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  pruneBackups();
  return { path: target, bytes: fs.statSync(target).size };
}

function pruneBackups(keep = 15) {
  const files = fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) {
    try { fs.unlinkSync(path.join(backupDir, f)); } catch { /* ignore */ }
  }
}

function listBackups() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const st = fs.statSync(path.join(backupDir, f));
      return { name: f, path: path.join(backupDir, f), bytes: st.size, savedAt: st.mtimeMs };
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}

function restoreBackup(backupPath) {
  if (!fs.existsSync(backupPath)) throw new Error("Backup file not found");
  // Keep the current state before replacing it - a mistaken restore must itself
  // be recoverable.
  backup("pre-restore");
  db.close();
  fs.copyFileSync(backupPath, dbPath);
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return readAll();
}

function stats() {
  const n = db.prepare("SELECT COUNT(*) AS n FROM invoices").get().n;
  // In WAL mode recent writes live in the -wal sidecar, so the main file alone
  // under-reports the ledger size until a checkpoint.
  let bytes = 0;
  for (const suffix of ["", "-wal", "-shm"]) {
    try { bytes += fs.statSync(dbPath + suffix).size; } catch { /* not present */ }
  }
  return { invoices: n, bytes, dbPath, backupDir, backups: listBackups().length };
}

function close() {
  if (db) { db.close(); db = null; }
}

const toEvent = (r) => ({
  id: r.id,
  workspaceId: r.workspace_id,
  createdAt: r.created_at,
  action: r.action,
  invoiceId: r.invoice_id || null,
  invoiceNo: r.invoice_no || "",
  clientName: r.client_name || "",
  summary: r.summary,
  before: parseJson(r.before_json, null),
  after: parseJson(r.after_json, null),
  batchId: r.batch_id || null,
  undone: Number(r.undone) === 1
});

function parseJson(raw, fallback) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function appendChangeEvents(events) {
  const list = Array.isArray(events) ? events : [events];
  if (!list.length) return { appended: 0 };
  const up = db.prepare(`
    INSERT INTO change_events (
      id, workspace_id, created_at, action, invoice_id, invoice_no, client_name,
      summary, before_json, after_json, batch_id, undone
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO NOTHING
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const ev of list) {
      up.run(
        String(ev.id),
        String(ev.workspaceId || "default"),
        String(ev.createdAt || new Date().toISOString()),
        String(ev.action || "updated"),
        ev.invoiceId ? String(ev.invoiceId) : null,
        String(ev.invoiceNo || ""),
        String(ev.clientName || ""),
        String(ev.summary || ""),
        ev.before == null ? null : JSON.stringify(ev.before),
        ev.after == null ? null : JSON.stringify(ev.after),
        ev.batchId ? String(ev.batchId) : null,
        ev.undone ? 1 : 0
      );
    }
    const workspaces = [...new Set(list.map((e) => String(e.workspaceId || "default")))];
    for (const ws of workspaces) pruneChangeEvents(ws);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { appended: list.length };
}

function pruneChangeEvents(workspaceId, cap = 5000) {
  const cutoff = db.prepare(`
    SELECT created_at FROM change_events
    WHERE workspace_id = ?
    ORDER BY created_at DESC
    LIMIT 1 OFFSET ?
  `).get(String(workspaceId), cap - 1);
  if (!cutoff) return;
  db.prepare(`
    DELETE FROM change_events
    WHERE workspace_id = ? AND created_at < ?
  `).run(String(workspaceId), cutoff.created_at);
}

function markChangeEventUndone(id, undone = true) {
  db.prepare("UPDATE change_events SET undone = ? WHERE id = ?").run(undone ? 1 : 0, String(id));
  return { ok: true };
}

function listChangeEvents(workspaceId) {
  const rows = workspaceId
    ? db.prepare(`
        SELECT * FROM change_events
        WHERE workspace_id = ?
        ORDER BY created_at DESC
      `).all(String(workspaceId))
    : db.prepare("SELECT * FROM change_events ORDER BY created_at DESC").all();
  return rows.map(toEvent);
}

module.exports = {
  init, isReady, readAll, applyInvoiceChanges, replaceInvoices,
  saveWorkspaceMeta, deleteWorkspace, saveClients, saveSettings,
  migrateFromLocalStorage, backup, listBackups, restoreBackup, stats, close,
  appendChangeEvents, listChangeEvents, markChangeEventUndone
};
