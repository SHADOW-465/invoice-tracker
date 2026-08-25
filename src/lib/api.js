// One data interface, two backings: the local Node server in the browser build, and
// direct filesystem access in the Tauri desktop build. Screens never know which.
// When /api is missing (static host), fall through to an in-memory sample ledger.
import { isDesktop, desktopApi } from "./desktop.js";
import { demoApi, demoActive, enableDemo } from "./demo.js";

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

function withDemoFallback(fn) {
  return async (...args) => {
    if (demoActive) return demoApi[fn.name]?.(...args) ?? fn(...args);
    try {
      return await fn(...args);
    } catch (e) {
      enableDemo();
      if (fn.name === "load" || args.length === 0) return demoApi.load();
      throw e;
    }
  };
}

const httpApi = {
  load: withDemoFallback(function load() {
    return call("GET", "/data");
  }),
  createInvoice: (inv) => (demoActive ? demoApi.createInvoice(inv) : call("POST", "/invoices", inv)),
  updateInvoice: (no, inv) =>
    demoActive ? demoApi.updateInvoice(no, inv) : call("PUT", `/invoices/${encodeURIComponent(no)}`, inv),
  deleteInvoice: (no) =>
    demoActive ? demoApi.deleteInvoice(no) : call("DELETE", `/invoices/${encodeURIComponent(no)}`),
  saveClient: (client) => (demoActive ? demoApi.saveClient(client) : call("POST", "/clients", client)),
  saveSettings: (settings) =>
    demoActive ? demoApi.saveSettings(settings) : call("POST", "/settings", settings)
};

export const api = new Proxy(
  {},
  { get: (_t, key) => (isDesktop() ? desktopApi : httpApi)[key] }
);
