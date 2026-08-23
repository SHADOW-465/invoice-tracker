// Local-only HTTP server for the browser build. Serves the built UI and a small REST
// API over the workbook. Binds to 127.0.0.1 — nothing on the network can reach it.
// The Tauri desktop build does not use this; it drives src/lib/workbook.js directly.
// ponytail: node:http, no framework. Six routes do not need Express.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { readAll, writeAll, BOOK } from "./store.js";
import { mutations } from "../src/lib/workbook.js";

const PORT = Number(process.env.PORT || 4321);
const DIST = path.resolve(import.meta.dirname, "..", "dist");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".png": "image/png"
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

// Every mutation is read-modify-write on the workbook, so a change made directly in
// Excel between two app actions is never silently overwritten by stale state.
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[0] === "api") {
    const key = `${req.method} /api/${parts[1]}`;
    const handler = ROUTES[key];
    if (!handler) return send(res, 404, { error: "Unknown endpoint" });
    try {
      const body = req.method === "GET" ? {} : await readJson(req);
      return send(res, 200, handler(body, decodeURIComponent(parts[2] || "")));
    } catch (err) {
      // Excel holds an exclusive lock on an open workbook — say so plainly.
      const locked = err.code === "EBUSY" || err.code === "EPERM";
      const status = locked ? 423 : err.status || 500;
      const message = locked
        ? `The workbook is open in Excel. Close "${path.basename(BOOK)}" and try again.`
        : err.message;
      console.error(`[api] ${key}: ${err.message}`);
      return send(res, status, err.errors ? { errors: err.errors } : { error: message });
    }
  }

  // Static: the built SPA. Any unknown path falls through to index.html.
  let file = path.join(DIST, url.pathname);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, "index.html");
  }
  if (!fs.existsSync(file)) {
    return send(res, 500, "Run `npm run build` first — dist/ is missing.", "text/plain");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FinanceOS  →  http://localhost:${PORT}`);
  console.log(`Ledger     →  ${BOOK}`);
});
