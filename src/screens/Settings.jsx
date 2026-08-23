import React, { useState } from "react";
import { Field } from "../components/ui";
import { SYMBOLS } from "../lib/format";

export function Settings({ ctx }) {
  const [form, setForm] = useState(ctx.settings);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setRate = (code, value) => setForm((f) => ({ ...f, rates: { ...f.rates, [code]: value } }));

  const dirty = JSON.stringify(form) !== JSON.stringify(ctx.settings);

  const save = async () => {
    setBusy(true);
    await ctx.saveSettings({
      ...form,
      defaultTermDays: Number(form.defaultTermDays) || 30,
      rates: Object.fromEntries(Object.entries(form.rates).map(([k, v]) => [k, Number(v) || 0]))
    });
    setBusy(false);
  };

  const currencies = Object.keys(form.rates || {});

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Workspace, currency and collection defaults. All of it lives in the workbook.</div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-title" style={{ marginBottom: 6 }}>Workspace</div>
        <Row k="Workspace name" help="Shown on invoices, PDFs and exports.">
          <input className="input" value={form.workspaceName || ""} onChange={(e) => set({ workspaceName: e.target.value })} />
        </Row>
        <Row k="Billing email" help="Used in the reminder emails you copy from an invoice.">
          <input className="input" value={form.workspaceEmail || ""} onChange={(e) => set({ workspaceEmail: e.target.value })} />
        </Row>
        <Row k="Tax ID" help="Printed under your address on generated invoices.">
          <input className="input" value={form.taxId || ""} onChange={(e) => set({ taxId: e.target.value })} />
        </Row>
        <Row k="Invoice prefix" help="New invoice numbers continue this series automatically.">
          <input className="input mono" value={form.invoicePrefix || ""} onChange={(e) => set({ invoicePrefix: e.target.value })} />
        </Row>
        <Row k="Base currency" help="Every converted total on the dashboard is expressed in this currency.">
          <select className="select" value={form.baseCurrency} onChange={(e) => set({ baseCurrency: e.target.value })}>
            {[...new Set([...currencies, ...Object.keys(SYMBOLS)])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Row>
        <Row k="Default payment terms" help="Applied to new invoices unless overridden.">
          <select className="select" value={form.defaultTermDays} onChange={(e) => set({ defaultTermDays: e.target.value })}>
            {[0, 7, 15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>Net {d}</option>)}
          </select>
        </Row>
      </section>

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-title">Exchange Rates</div>
        <div className="card-sub" style={{ marginBottom: 14 }}>
          One unit of each currency, expressed in {form.baseCurrency}. Update these when your accountant does.
        </div>
        <div className="rate-grid">
          {currencies.map((code) => (
            <div key={code} className="rate-card">
              <div className="rate-code">{code} / {form.baseCurrency}</div>
              <input
                className="input mono" type="number" step="0.0001" min="0" style={{ marginTop: 6 }}
                value={form.rates[code]} disabled={code === form.baseCurrency}
                onChange={(e) => setRate(code, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="card-title" style={{ marginBottom: 6 }}>Invoice Document</div>
        <Field label="Address block (one line per row)">
          <textarea className="textarea" value={form.workspaceAddress || ""}
            onChange={(e) => set({ workspaceAddress: e.target.value })} />
        </Field>
        <div style={{ height: 14 }} />
        <Field label="Bank / payment instructions">
          <textarea className="textarea" value={form.bankDetails || ""}
            onChange={(e) => set({ bankDetails: e.target.value })} />
        </Field>
      </section>

      <section className="card card-pad">
        <div className="card-title">Data</div>
        <div className="card-sub" style={{ marginBottom: 12 }}>
          Everything you see is read from and written straight back to this workbook. Open it in Excel any time —
          just close it again before saving from here, or Windows will refuse the write.
        </div>
        <div className="kv">
          <span className="kv-k">Ledger file</span>
          <span className="kv-v mono">{ctx.file}</span>
        </div>
        {ctx.isDesktop && (
          <div className="setting-row">
            <div>
              <div className="setting-k">Use a different workbook</div>
              <div className="setting-help">Point FinanceOS at another file — the current one is left untouched.</div>
            </div>
            <div className="setting-control" style={{ textAlign: "right" }}>
              <button className="btn" onClick={ctx.chooseLedger}>Choose workbook…</button>
            </div>
          </div>
        )}
        <div className="kv"><span className="kv-k">Invoices</span><span className="kv-v">{ctx.all.length}</span></div>
        <div className="kv"><span className="kv-k">Clients</span><span className="kv-v">{ctx.clients.length}</span></div>
        <div className="kv"><span className="kv-k">Backups</span><span className="kv-v">Last 30 saves kept in <span className="mono">backups/</span></span></div>
      </section>
    </div>
  );
}

const Row = ({ k, help, children }) => (
  <div className="setting-row">
    <div>
      <div className="setting-k">{k}</div>
      <div className="setting-help">{help}</div>
    </div>
    <div className="setting-control">{children}</div>
  </div>
);
