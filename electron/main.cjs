const { app, BrowserWindow, Menu, nativeImage, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const ledger = require("./ledger-db.cjs");

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, "../public/icon.ico");
  const pngPath = path.join(__dirname, "../public/icon.png");

  let winIcon;
  if (fs.existsSync(iconPath)) {
    winIcon = nativeImage.createFromPath(iconPath);
  } else if (fs.existsSync(pngPath)) {
    winIcon = nativeImage.createFromPath(pngPath);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: "Simon & Son — Invoice Ledger",
    backgroundColor: "#0d1117",
    icon: winIcon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // The renderer reaches the database only through the narrow, audited surface
      // in preload.cjs - it still has no direct Node or filesystem access.
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  // Load the built Vite bundle
  const indexPath = path.join(__dirname, "../dist/index.html");
  mainWindow.loadFile(indexPath);

  // Remove default menu bar for clean native app feel
  Menu.setApplicationMenu(null);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Every ledger operation the renderer can request.
 *
 * Each handler returns { ok, ... } instead of throwing across the IPC boundary, so
 * the interface can explain a failure rather than dying on an unhandled rejection.
 */
function registerLedgerHandlers() {
  const handle = (channel, fn) => {
    ipcMain.handle(channel, async (_event, args) => {
      try {
        return { ok: true, data: await fn(args || {}) };
      } catch (error) {
        console.error(`[ledger] ${channel} failed:`, error);
        return { ok: false, error: error.message || String(error), code: error.code || null };
      }
    });
  };

  handle("ledger:readAll", () => ledger.readAll());
  handle("ledger:stats", () => ledger.stats());
  handle("ledger:applyInvoiceChanges", ({ workspaceId, changes }) =>
    ledger.applyInvoiceChanges(workspaceId, changes));
  handle("ledger:replaceInvoices", ({ workspaceId, invoices }) =>
    ledger.replaceInvoices(workspaceId, invoices));
  handle("ledger:saveWorkspaceMeta", ({ workspaces }) => ledger.saveWorkspaceMeta(workspaces));
  handle("ledger:deleteWorkspace", ({ id }) => ledger.deleteWorkspace(id));
  handle("ledger:saveClients", ({ clients }) => ledger.saveClients(clients));
  handle("ledger:saveSettings", ({ settings }) => ledger.saveSettings(settings));
  handle("ledger:migrate", ({ payload }) => ledger.migrateFromLocalStorage(payload));
  handle("ledger:backup", ({ reason }) => ledger.backup(reason || "manual"));
  handle("ledger:listBackups", () => ledger.listBackups());
  handle("ledger:restoreBackup", ({ path: p }) => ledger.restoreBackup(p));
  handle("ledger:revealBackups", () => {
    const { backupDir } = ledger.stats();
    shell.openPath(backupDir);
    return { opened: backupDir };
  });
}

app.whenReady().then(() => {
  // Open the database before any window exists. If this fails the app cannot
  // safely run at all, so say so plainly rather than opening onto an empty ledger.
  try {
    ledger.init(app.getPath("userData"));
    ledger.backup("startup");
  } catch (error) {
    console.error("[ledger] failed to open database", error);
    dialog.showErrorBox(
      "Invoice Ledger could not start",
      `The invoice database could not be opened.

${error.message}

` +
      `Your data has not been changed. Try restarting; if this continues, ` +
      `copy the folder below before reinstalling:
${app.getPath("userData")}`
    );
    app.quit();
    return;
  }

  registerLedgerHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Flush and close cleanly so WAL is checkpointed into the main database file.
app.on("before-quit", () => {
  try { ledger.close(); } catch { /* already closed */ }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
