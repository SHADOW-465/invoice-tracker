import React, { useState } from "react";
import { Field } from "./ui";
import { SYMBOLS } from "../lib/format";

export function ClientDrawer({ ctx, client, onClose }) {
  const [form, setForm] = useState(
    client || { name: "", fullName: "", email: "", currency: ctx.base, termDays: 30, taxRate: 0, notes: "" }
  );
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    await ctx.saveClient({ ...form, originalName: client?.name });
    setBusy(false);
  };

  return (
    <div className="drawer" role="dialog" aria-label="Client">
      <div className="drawer-head">
        <div>
          <div className="drawer-title">{client ? `Edit ${client.name}` : "New Client"}</div>
          <div className="drawer-sub">Defaults here prefill every new invoice for this client.</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        <Field label="Ledger name" hint="The exact name used in the invoice sheet. Renaming updates every invoice.">
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Display name">
          <input className="input" value={form.fullName || ""} onChange={(e) => set({ fullName: e.target.value })}
            placeholder="e.g. Ashworth Media Ltd" />
        </Field>
        <Field label="Billing email">
          <input className="input" type="email" value={form.email || ""} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Default currency">
            <select className="select" value={form.currency || ""} onChange={(e) => set({ currency: e.target.value })}>
              <option value="">—</option>
              {Object.keys({ ...SYMBOLS, ...ctx.rates }).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default terms">
            <select className="select" value={form.termDays} onChange={(e) => set({ termDays: Number(e.target.value) })}>
              {[0, 7, 15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>Net {d}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Standing withholding %" hint="Applied automatically to new invoices for this client.">
          <input className="input mono" type="number" step="0.01" min="0" max="100" value={form.taxRate || 0}
            onChange={(e) => set({ taxRate: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea className="textarea" value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>

      <div className="drawer-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>
          {busy ? "Saving…" : "Save client"}
        </button>
      </div>
    </div>
  );
}
