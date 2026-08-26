/**
 * Preload bridge.
 *
 * The renderer stays sandboxed with context isolation on; it never touches Node or
 * the filesystem. It can only call the specific ledger operations listed here, and
 * every one of them returns a plain serialisable result.
 */
const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("ledgerAPI", {
  available: true,

  // read
  readAll: () => invoke("ledger:readAll"),
  stats: () => invoke("ledger:stats"),

  // write
  applyInvoiceChanges: (workspaceId, changes) =>
    invoke("ledger:applyInvoiceChanges", { workspaceId, changes }),
  replaceInvoices: (workspaceId, invoices) =>
    invoke("ledger:replaceInvoices", { workspaceId, invoices }),
  saveWorkspaceMeta: (workspaces) => invoke("ledger:saveWorkspaceMeta", { workspaces }),
  deleteWorkspace: (id) => invoke("ledger:deleteWorkspace", { id }),
  saveClients: (clients) => invoke("ledger:saveClients", { clients }),
  saveSettings: (settings) => invoke("ledger:saveSettings", { settings }),

  // one-time move off browser storage
  migrateFromLocalStorage: (payload) => invoke("ledger:migrate", { payload }),

  // backups
  backup: (reason) => invoke("ledger:backup", { reason }),
  listBackups: () => invoke("ledger:listBackups"),
  restoreBackup: (path) => invoke("ledger:restoreBackup", { path }),
  revealBackups: () => invoke("ledger:revealBackups")
});
