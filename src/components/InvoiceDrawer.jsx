import React, { useEffect, useState } from "react";
import { Field } from "./ui";
import { addDays, monthOf, money, today, SYMBOLS } from "../lib/format";
import { nextInvoiceNo } from "../lib/derive";

const MODES = ["Online", "Wire", "NEFT", "Bank Transfer", "ACH", "Cheque", "Card", "PayPal"];

export function InvoiceDrawer({ ctx, invoice, onClose }) {
  const editing = !!invoice;
  const client = (name) => ctx.clients.find((c) => c.name === name);

  const [form, setForm] = useState(() =>
    invoice
      ? { ...invoice, termDays: invoice.termDays || 30 }
      : {
          invoiceNo: nextInvoiceNo(ctx.all, ctx.settings.invoicePrefix || "INV"),
          clientName: "",
          amount: "",
          currency: ctx.settings.baseCurrency || "USD",
          paymentMode: ctx.settings.defaultPaymentMode || "Online",
          raisedOn: today(),
          termDays: Number(ctx.settings.defaultTermDays) || 30,
          taxRate: 0,
          remarks: "",
          status: "Outstanding"
        }
  );
  const [busy, setBusy] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Picking a known client pulls in their currency, terms and standing withholding.
  const onClientChange = (name) => {
    const c = client(name);
    set({
      clientName: name,
      ...(c && !editing
        ? { currency: c.currency || form.currency, termDays: c.termDays || form.termDays, taxRate: c.taxRate || 0 }
        : {})
    });
  };

  const dueDate = addDays(form.raisedOn, Number(form.termDays) || 0);
  const amount = Number(form.amount) || 0;
  const taxAmount = Math.round(((amount * (Number(form.taxRate) || 0)) / 100) * 100) / 100;
  const settled = form.status === "Received";

  // Flipping the status is a real edit, not just a label: marking Received fills in a
  // date and the expected net, and reverting to Outstanding clears the receipt so the
  // payments ledger cannot keep a settlement that no longer exists.
  const setStatus = (next) =>
    set(
      next === "Received"
        ? {
            status: "Received",
            receivedOn: form.receivedOn || today(),
            amountReceived:
              Number(form.amountReceived) > 0
                ? form.amountReceived
                : Math.round((amount - taxAmount) * 100) / 100
          }
        : { status: "Outstanding", receivedOn: "", amountReceived: 0 }
    );

  const save = async () => {
    setBusy(true);
    const ok = await ctx.saveInvoice(editing ? invoice.invoiceNo : null, {
      ...form,
      amount,
      taxRate: Number(form.taxRate) || 0,
      taxAmount,
      dueDate,
      invoicedMonth: monthOf(form.raisedOn)
    });
    setBusy(false);
    // Stay where the edit started. Only the detail screen has to follow the invoice,
    // and only because a renumber would leave its route pointing at nothing.
    if (ok && editing && ctx.route.screen === "invoice") ctx.go("invoice", { invoiceNo: form.invoiceNo });
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="drawer" role="dialog" aria-label={editing ? "Edit invoice" : "New invoice"}>
      <div className="drawer-head">
        <div>
          <div className="drawer-title">{editing ? `Edit ${invoice.invoiceNo}` : "New Invoice"}</div>
          <div className="drawer-sub">Tab through fields · ⌘↵ to save</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        <Field label="Invoice number">
          <input className="input mono" value={form.invoiceNo} onChange={(e) => set({ invoiceNo: e.target.value })} />
        </Field>

        <Field label="Client" hint="Type a new name to create the client automatically.">
          <input
            className="input"
            list="client-options"
            value={form.clientName}
            onChange={(e) => onClientChange(e.target.value)}
            placeholder="Search or create a client"
          />
          <datalist id="client-options">
            {ctx.clients.map((c) => <option key={c.name} value={c.name}>{c.fullName || c.name}</option>)}
          </datalist>
        </Field>

        <div className="grid-2">
          <Field label="Amount">
            <input
              className="input mono" type="number" step="0.01" min="0" value={form.amount}
              onChange={(e) => set({ amount: e.target.value })} placeholder="0.00"
            />
          </Field>
          <Field label="Currency">
            <select className="select" value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
              {Object.keys({ ...SYMBOLS, ...ctx.rates }).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Raised on">
            <input className="input" type="date" value={form.raisedOn} onChange={(e) => set({ raisedOn: e.target.value })} />
          </Field>
          <Field label="Payment terms">
            <select className="select" value={form.termDays} onChange={(e) => set({ termDays: Number(e.target.value) })}>
              {[0, 7, 15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>Net {d}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Due date"><input className="input" value={dueDate} disabled /></Field>
          <Field label="Payment method">
            <select className="select" value={form.paymentMode} onChange={(e) => set({ paymentMode: e.target.value })}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        <Field
          label="Withholding tax %"
          hint={taxAmount ? `${money(taxAmount, form.currency)} will be deducted at source — net ${money(amount - taxAmount, form.currency)}.` : "Leave at 0 if the client pays the full amount."}
        >
          <input
            className="input mono" type="number" step="0.01" min="0" max="100" value={form.taxRate}
            onChange={(e) => set({ taxRate: e.target.value })}
          />
        </Field>

        <Field
          label="Collection status"
          hint={settled
            ? "Switch back to Outstanding to undo a payment recorded by mistake."
            : "Overdue is worked out from the due date — you never set it by hand."}
        >
          <select className="select" value={settled ? "Received" : "Outstanding"}
            onChange={(e) => setStatus(e.target.value)}>
            <option value="Outstanding">Outstanding</option>
            <option value="Received">Received</option>
          </select>
        </Field>

        {settled && (
          <div className="grid-2">
            <Field label="Received on">
              <input className="input" type="date" value={form.receivedOn || ""}
                onChange={(e) => set({ receivedOn: e.target.value })} />
            </Field>
            <Field label={`Amount received (${form.currency})`}>
              <input className="input mono" type="number" step="0.01" value={form.amountReceived ?? ""}
                onChange={(e) => set({ amountReceived: e.target.value })} />
            </Field>
          </div>
        )}

        <Field label="Remarks">
          <textarea
            className="textarea" value={form.remarks || ""}
            onChange={(e) => set({ remarks: e.target.value })} placeholder="Optional context for the audit trail"
          />
        </Field>
      </div>

      <div className="drawer-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save to ledger"}
        </button>
      </div>
    </div>
  );
}
