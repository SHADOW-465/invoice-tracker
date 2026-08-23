// One data interface, two backings: the local Node server in the browser build, and
// direct filesystem access in the Tauri desktop build. Screens never know which.
import { isDesktop, desktopApi } from "./desktop.js";

async function call(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.errors?.join(" · ") || data.error || `Request failed (${res.status})`);
  return data;
}

const httpApi = {
  load: () => call("GET", "/data"),
  createInvoice: (inv) => call("POST", "/invoices", inv),
  updateInvoice: (no, inv) => call("PUT", `/invoices/${encodeURIComponent(no)}`, inv),
  deleteInvoice: (no) => call("DELETE", `/invoices/${encodeURIComponent(no)}`),
  saveClient: (client) => call("POST", "/clients", client),
  saveSettings: (settings) => call("POST", "/settings", settings)
};

export const api = new Proxy(
  {},
  { get: (_t, key) => (isDesktop() ? desktopApi : httpApi)[key] }
);
