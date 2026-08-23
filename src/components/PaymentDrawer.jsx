import React, { useEffect, useState } from "react";
import { Field } from "./ui";
import { money, today } from "../lib/format";

const round2 = (n) => Math.round(n * 100) / 100;

export function PaymentDrawer({ ctx, invoice, onClose }) {
  const open = ctx.all.filter((i) => i.status !== "Received");
  const [target, setTarget] = useState(invoice || open[0] || ctx.all[0]);
  const [taxRate, setTaxRate] = useState(String(target?.taxRate || 0));
  const [received, setReceived] = useState(() =>
    target ? String(round2(target.amount - (target.amount * (target.taxRate || 0)) / 100)) : ""
  );
  const [receivedOn, setReceivedOn] = useState(today());
  const [mode, setMode] = useState(target?.paymentMode || "Online");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const switchTarget = (no) => {
    const next = ctx.all.find((i) => i.invoiceNo === no);
    if (!next) return;
    setTarget(next);
    setTaxRate(String(next.taxRate || 0));
    setReceived(String(round2(next.amount - (next.amount * (next.taxRate || 0)) / 100)));
    setMode(next.paymentMode || "Online");
  };

  const applyTax = (rate) => {
    setTaxRate(rate);
    const r = Number(rate) || 0;
    setReceived(String(round2(target.amount - (target.amount * r) / 100)));
  };

  const recv = Number(received);
  const diff = (isNaN(recv) ? 0 : recv) - (target?.amount || 0);
  const settled = Math.abs(diff) < 0.005;
  const taxAmount = round2((target?.amount || 0) * ((Number(taxRate) || 0) / 100));
  // Anything short beyond the declared withholding is unexplained — flag it, don't bury it.
  const unexplained = round2(Math.abs(diff) - taxAmount);

  const save = async () => {
    if (!target) return;
    setBusy(true);
    const remarks = [target.remarks, note.trim(), Number(taxRate) > 0 && !`${target.remarks}`.includes(`${taxRate}%`)
      ? `Received after ${taxRate}% tax deduction` : ""]
      .filter(Boolean)
      .join(" | ");
    const ok = await ctx.saveInvoice(target.invoiceNo, {
      ...target,
      status: "Received",
      receivedOn,
      paymentMode: mode,
      taxRate: Number(taxRate) || 0,
      taxAmount,
      amountReceived: isNaN(recv) ? target.amount : recv,
      remarks
    });
    setBusy(false);
    if (ok) ctx.fire(`Payment recorded against ${target.invoiceNo}`);
  };

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!target) {
    return (
      <div className="drawer">
        <div className="drawer-head">
          <div className="drawer-title">Record Payment</div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body"><div className="empty-sub">No invoices to settle yet.</div></div>
      </div>
    );
  }

  return (
    <div className="drawer" role="dialog" aria-label="Record payment">
      <div className="drawer-head">
        <div>
          <div className="drawer-title">Record Payment</div>
          <div className="drawer-sub">{target.invoiceNo} · {target.clientName}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="drawer-body">
        <Field label="Invoice">
          <select className="select" value={target.invoiceNo} onChange={(e) => switchTarget(e.target.value)}>
            {(open.length ? open : ctx.all).map((i) => (
              <option key={i.invoiceNo} value={i.invoiceNo}>
                {i.invoiceNo} · {i.clientName} · {money(i.amount, i.currency)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid-2">
          <Field label="Withholding tax %">
            <input className="input mono" type="number" step="0.01" min="0" max="100" value={taxRate}
              onChange={(e) => applyTax(e.target.value)} />
          </Field>
          <Field label={`Amount received (${target.currency})`}>
            <input className="input mono" type="number" step="0.01" value={received}
              onChange={(e) => setReceived(e.target.value)} />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Received on">
            <input className="input" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
          </Field>
          <Field label="Payment method">
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
              {["Online", "Wire", "NEFT", "Bank Transfer", "ACH", "Cheque", "Card", "PayPal"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional context for the audit trail" />
        </Field>

        <div className="recon">
          <div className="recon-title">Reconciliation</div>
          <div className="recon-row"><span className="muted">Invoice amount</span><span className="mono">{money(target.amount, target.currency)}</span></div>
          <div className="recon-row"><span className="muted">Withholding ({taxRate || 0}%)</span><span className="mono">−{money(taxAmount, target.currency)}</span></div>
          <div className="recon-row"><span className="muted">Amount received</span><span className="mono">{money(isNaN(recv) ? 0 : recv, target.currency)}</span></div>
          <div className="recon-row">
            <span className="muted">Difference</span>
            <span className={`mono ${settled ? "pos" : "neg"}`}>{diff > 0 ? "+" : ""}{money(diff, target.currency)}</span>
          </div>
          <div className={`recon-note ${settled ? "muted" : "warn"}`}>
            {settled
              ? "Full settlement. The invoice will be closed."
              : unexplained <= 0.01
              ? `Short by exactly the ${taxRate}% withholding. Recorded as tax deducted at source.`
              : `Short receipt of ${money(Math.abs(diff), target.currency)} (${((Math.abs(diff) / target.amount) * 100).toFixed(1)}%), of which ${money(unexplained, target.currency)} is beyond the declared withholding. Record the reason so the shortfall is auditable rather than buried in remarks.`}
          </div>
        </div>
      </div>

      <div className="drawer-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Record Payment"}</button>
      </div>
    </div>
  );
}
