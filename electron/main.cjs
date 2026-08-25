const { app, BrowserWindow, Menu, nativeImage } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { pathToFileURL } = require("url");

let mainWindow;
let server;
let port = 0;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".png": "image/png"
};

const send = (res, code, body, type = "application/json") =>
  res.writeHead(code, { "Content-Type": type }).end(
    type === "application/json" ? JSON.stringify(body) : body
  );

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2e6) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Malformed JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function startEmbeddedServer(bookPath) {
  const wbPath = path.join(__dirname, "../src/lib/workbook.js");
  const { parseWorkbook, buildWorkbook, mutations, emptyWorkbook } = await import(pathToFileURL(wbPath).href);

  const DIST = path.join(__dirname, "../dist");
  const BACKUPS = path.join(path.dirname(bookPath), "backups");

  const bytes = () => (fs.existsSync(bookPath) ? new Uint8Array(fs.readFileSync(bookPath)) : null);

  // If workbook does not exist, initialize it cleanly
  if (!fs.existsSync(bookPath)) {
    try {
      const sampleSrc = path.join(__dirname, "../Invoice Tracker.xlsx");
      if (fs.existsSync(sampleSrc)) {
        fs.copyFileSync(sampleSrc, bookPath);
      } else {
        const initial = buildWorkbook(emptyWorkbook());
        fs.writeFileSync(bookPath, initial);
      }
    } catch (e) {
      console.warn("Could not copy initial workbook:", e.message);
    }
  }

  function readAll() {
    return { ...parseWorkbook(bytes()), file: bookPath };
  }

  function writeAll(data) {
    const out = buildWorkbook(data, bytes());
    if (fs.existsSync(bookPath)) {
      try {
        fs.mkdirSync(BACKUPS, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        fs.copyFileSync(bookPath, path.join(BACKUPS, `Invoice Tracker ${stamp}.xlsx`));
        const stale = fs.readdirSync(BACKUPS).filter((f) => f.endsWith(".xlsx")).sort().slice(0, -30);
        for (const f of stale) fs.unlinkSync(path.join(BACKUPS, f));
      } catch (e) {}
    }
    const tmp = bookPath.replace(/\.xlsx$/i, "") + ".saving.xlsx";
    fs.writeFileSync(tmp, out);
    fs.renameSync(tmp, bookPath);
  }

  function mutate(name, body, arg) {
    const data = readAll();
    mutations[name](data, body, arg);
    writeAll(data);
    return readAll();
  }

  const ROUTES = {
    "GET /api/data": () => readAll(),
    "POST /api/invoices": (body) => mutate("createInvoice", body),
    "PUT /api/invoices": (body, no) => mutate("updateInvoice", body, no),
    "DELETE /api/invoices": (body, no) => mutate("deleteInvoice", body, no),
    "POST /api/clients": (body) => mutate("saveClient", body),
    "POST /api/settings": (body) => mutate("saveSettings", body)
  };

  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
      const pathname = decodeURIComponent(url.pathname);
      const key = `${req.method} ${pathname}`;

      // 1. API Route matching
      if (ROUTES[key]) {
        try {
          const body = ["POST", "PUT"].includes(req.method) ? await readJson(req) : undefined;
          return send(res, 200, ROUTES[key](body));
        } catch (e) {
          return send(res, 400, { error: e.message });
        }
      }

      // Dynamic sub-route matching e.g. PUT /api/invoices/INV-001
      for (const prefix of ["PUT /api/invoices", "DELETE /api/invoices"]) {
        if (key.startsWith(prefix + "/")) {
          const arg = key.slice(prefix.length + 1);
          try {
            const body = req.method === "PUT" ? await readJson(req) : undefined;
            return send(res, 200, ROUTES[prefix](body, arg));
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
        }
      }

      // 2. Static File Serving from dist/
      const filePath = path.join(DIST, pathname === "/" ? "index.html" : pathname.slice(1));
      const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? filePath
        : path.join(DIST, "index.html");

      if (fs.existsSync(target)) {
        const ext = path.extname(target);
        return send(res, 200, fs.readFileSync(target), MIME[ext] || "application/octet-stream");
      }

      send(res, 404, "Not Found", "text/plain");
    });

    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      console.log(`Embedded server running on http://127.0.0.1:${port}`);
      resolve(port);
    });
  });
}

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
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    title: "Simon & Son — Invoice Ledger",
    backgroundColor: "#F6F6F4",
    icon: winIcon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Use userData or local folder for ledger storage
  const defaultDir = path.join(app.getPath("documents"), "Simon & Son Invoices");
  fs.mkdirSync(defaultDir, { recursive: true });
  const bookPath = process.env.LEDGER_FILE || path.join(defaultDir, "Invoice Tracker.xlsx");

  await startEmbeddedServer(bookPath);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (server) {
    try { server.close(); } catch (e) {}
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
