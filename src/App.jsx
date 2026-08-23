import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { isDesktop, pickLedger, savedPath } from "./lib/desktop";
import { decorate, nextInvoiceNo } from "./lib/derive";
import { today } from "./lib/format";
import { Topbar } from "./components/Topbar";
import { CommandPalette } from "./components/CommandPalette";
import { InvoiceDrawer } from "./components/InvoiceDrawer";
import { PaymentDrawer } from "./components/PaymentDrawer";
import { ClientDrawer } from "./components/ClientDrawer";
import { Welcome } from "./components/Welcome";
import { Workspace } from "./screens/Workspace";
import { InvoiceDetail } from "./screens/InvoiceDetail";
import { Collections } from "./screens/Collections";
import { Clients } from "./screens/Clients";
import { ClientProfile } from "./screens/ClientProfile";
import { Payments } from "./screens/Payments";
import { Reports } from "./screens/Reports";
import { Settings } from "./screens/Settings";

const SCREENS = {
  workspace: Workspace,
  invoice: InvoiceDetail,
  collections: Collections,
  clients: Clients,
  client: ClientProfile,
  payments: Payments,
  reports: Reports,
  settings: Settings
};

export function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [needsLedger, setNeedsLedger] = useState(isDesktop() && !savedPath());
  const [route, setRoute] = useState({ screen: "workspace" });
  const [display, setDisplay] = useState(null);
  const [toast, setToast] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);

  const reload = useCallback(async () => {
    try {
      setData(await api.load());
      setNeedsLedger(false);
      setError("");
    } catch (e) {
      if (e.needsLedger) return setNeedsLedger(true);
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!needsLedger) reload();
  }, [reload, needsLedger]);

  const chooseLedger = useCallback(async () => {
    const path = await pickLedger();
    if (path) {
      setNeedsLedger(false);
      await reload();
    }
  }, [reload]);

  const fire = useCallback((message, kind = "ok") => {
    setToast({ message, kind });
    clearTimeout(fire.t);
    fire.t = setTimeout(() => setToast(null), 3200);
  }, []);

  const go = useCallback((screen, params = {}) => {
    setRoute({ screen, ...params });
    setPaletteOpen(false);
    setDrawer(null);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setDrawer(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Any mutation re-reads the workbook, so the UI can never drift from the file.
  const run = useCallback(
    async (fn, okMessage) => {
      try {
        setData(await fn());
        setDrawer(null);
        setError("");
        if (okMessage) fire(okMessage);
        return true;
      } catch (e) {
        fire(e.message, "error");
        return false;
      }
    },
    [fire]
  );

  const rates = data?.settings?.rates;
  const ledgerBase = data?.settings?.baseCurrency || "INR";
  // The display currency starts at the workbook's base and is a view choice from then
  // on — switching it re-expresses every figure rather than hiding any invoice.
  const base = display || ledgerBase;

  const all = useMemo(
    () => (data ? decorate(data.invoices, rates, base) : []),
    [data, rates, base]
  );

  const currencies = useMemo(() => {
    const known = new Set([ledgerBase, ...Object.keys(rates || {}), ...(data?.invoices || []).map((i) => i.currency)]);
    return [...known].filter((c) => c && (rates?.[c] || c === ledgerBase)).sort();
  }, [rates, ledgerBase, data]);

  const ctx = useMemo(
    () => ({
      all,
      list: all,
      clients: data?.clients || [],
      settings: data?.settings || {},
      base,
      ledgerBase,
      currencies,
      setBase: setDisplay,
      rates: rates || {},
      file: data?.file,
      route,
      go,
      fire,
      openPalette: () => setPaletteOpen(true),
      newInvoice: () => setDrawer({ kind: "invoice", invoice: null }),
      editInvoice: (invoice) => setDrawer({ kind: "invoice", invoice }),
      recordPayment: (invoice) => setDrawer({ kind: "payment", invoice }),
      editClient: (client) => setDrawer({ kind: "client", client }),
      chooseLedger,
      isDesktop: isDesktop(),
      saveInvoice: (no, body) =>
        run(
          () => (no ? api.updateInvoice(no, body) : api.createInvoice(body)),
          no ? `Invoice ${body.invoiceNo} updated` : `Invoice ${body.invoiceNo} created`
        ),
      deleteInvoice: (no) => run(() => api.deleteInvoice(no), `Invoice ${no} deleted`),
      // Copy an invoice as a fresh, unpaid one — the quickest way to raise next
      // month's identical bill, and the one thing the old single-page version had
      // that the redesign dropped.
      duplicateInvoice: (inv) => {
        const copy = {
          ...inv,
          invoiceNo: nextInvoiceNo(all, data?.settings?.invoicePrefix || "INV"),
          raisedOn: today(),
          dueDate: "",
          status: "Outstanding",
          receivedOn: "",
          amountReceived: 0,
          remarks: inv.remarks ? `Copy of ${inv.invoiceNo} — ${inv.remarks}` : `Copy of ${inv.invoiceNo}`
        };
        return run(() => api.createInvoice(copy), `Duplicated ${inv.invoiceNo} as ${copy.invoiceNo}`);
      },
      saveClient: (body) => run(() => api.saveClient(body), `Client ${body.name} saved`),
      saveSettings: (body) => run(() => api.saveSettings(body), "Settings saved")
    }),
    [all, data, base, ledgerBase, currencies, rates, route, go, fire, run, chooseLedger]
  );

  if (needsLedger) return <Welcome onChoose={chooseLedger} error={error} />;

  if (!data) {
    return (
      <div className="loading">
        {error ? `Cannot open the ledger — ${error}` : "Opening the ledger…"}
      </div>
    );
  }

  const Screen = SCREENS[route.screen] || Workspace;

  return (
    <div className="app">
      <Topbar ctx={ctx} />
      <main className="main">
        {error && (
          <div className="page" style={{ paddingBottom: 0 }}>
            <div className="banner">⚠ {error}</div>
          </div>
        )}
        <Screen ctx={ctx} />
      </main>

      {drawer && <div className="scrim" onClick={() => setDrawer(null)} />}
      {drawer?.kind === "invoice" && (
        <InvoiceDrawer ctx={ctx} invoice={drawer.invoice} onClose={() => setDrawer(null)} />
      )}
      {drawer?.kind === "payment" && (
        <PaymentDrawer ctx={ctx} invoice={drawer.invoice} onClose={() => setDrawer(null)} />
      )}
      {drawer?.kind === "client" && (
        <ClientDrawer ctx={ctx} client={drawer.client} onClose={() => setDrawer(null)} />
      )}

      {paletteOpen && <CommandPalette ctx={ctx} onClose={() => setPaletteOpen(false)} />}

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "error" : ""}`} role="status" aria-live="polite">
          <span>{toast.kind === "error" ? "⚠" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
