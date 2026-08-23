import React, { useState } from "react";
import { Badge, Empty } from "../components/ui";
import { compact, fmtLong, group, money, symbolOf } from "../lib/format";
import { invoicePdf, reminderText } from "../lib/exporters";

export function InvoiceDetail({ ctx }) {
  const inv = ctx.all.find((i) => i.invoiceNo === ctx.route.invoiceNo);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!inv) {
    return (
      <div className="page">
        <button className="back-link" onClick={() => ctx.go("workspace")}>← Workspace</button>
        <Empty title="Invoice not found" sub="It may have been deleted or renumbered." />
      </div>
    );
  }

  const { base, rates, settings } = ctx;
  const rate = rates[inv.currency] || 1;
  const settled = inv.status === "Received";

  const timeline = [
    { label: "Invoice Raised", date: fmtLong(inv.raisedOn), note: `${inv.paymentMode} · ${inv.currency}`, on: true },
    {
      label: "Payment Due",
      date: fmtLong(inv.dueDate),
      note: settled ? `Net ${inv.termDays || 30} terms` : inv.overdueDays > 0 ? `${inv.overdueDays} days past due` : `Due in ${inv.daysToDue} days`,
      on: settled || inv.overdueDays > 0
    },
    {
      label: "Payment Received",
      date: inv.receivedOn ? fmtLong(inv.receivedOn) : "Pending",
      note: inv.daysToCollect !== null ? `${inv.daysToCollect} days after raising` : "Not yet received",
      on: settled
    }
  ];

  const copyReminder = async () => {
    const { subject, body } = reminderText(inv, settings);
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      ctx.fire("Reminder email copied to clipboard");
    } catch {
      ctx.fire("Clipboard blocked by the browser", "error");
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    const ok = await ctx.deleteInvoice(inv.invoiceNo);
    if (ok) ctx.go("invoices");
  };

  return (
    <div className="page">
      <button className="back-link" onClick={() => ctx.go("workspace")}>← Workspace</button>

      <div className="page-head">
        <div>
          <div className="row">
            <h1 className="mono">{inv.invoiceNo}</h1>
            <Badge status={inv.status} />
          </div>
          <div className="sub">
            <button className="link-btn" style={{ fontFamily: "inherit" }} onClick={() => ctx.go("client", { clientName: inv.clientName })}>
              {inv.clientName}
            </button>
            {" · "}Invoiced {inv.month} {inv.raisedOn.slice(0, 4)}
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!settled && <button className="btn btn-primary" onClick={() => ctx.recordPayment(inv)}>Record Payment</button>}
          <button className="btn" onClick={() => ctx.editInvoice(inv)}>Edit Invoice</button>
          <button className="btn" onClick={() => ctx.duplicateInvoice(inv)}>Duplicate</button>
          <button className="btn" onClick={() => invoicePdf(inv, settings)}>Download PDF</button>
          <button className="btn" onClick={copyReminder}>Copy Reminder</button>
          <button className={`btn btn-danger ${confirmDelete ? "btn-primary" : ""}`} onClick={remove}
            onBlur={() => setConfirmDelete(false)}>
            {confirmDelete ? "Click again to delete" : "Delete"}
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div style={{ display: "grid", gap: 18 }}>
          <section className="card card-pad">
            <div className="kpi-label">Invoice amount</div>
            <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <div className="amount-big">{money(inv.amount, inv.currency)}</div>
              <div className="dim">{inv.currency}</div>
            </div>
            <div className="sub-line">
              {inv.currency === base
                ? "Base currency"
                : `≈ ${symbolOf(base)}${group(inv.base, 2)} at ${rate} ${base}/${inv.currency}`}
            </div>

            <div className="timeline">
              {timeline.map((t, idx) => (
                <div key={t.label} className="tl-step">
                  <div className="tl-rail">
                    <span className={`tl-dot ${t.on ? "on" : ""}`} />
                    {idx < 2 && <span className={`tl-line ${timeline[idx + 1].on ? "on" : ""}`} />}
                  </div>
                  <div className="tl-label">{t.label}</div>
                  <div className="tl-date">{t.date}</div>
                  <div className="tl-note">{t.note}</div>
                </div>
              ))}
            </div>
          </section>

          {inv.remarks && (
            <section className="card card-pad">
              <div className="card-title" style={{ marginBottom: 8 }}>Notes</div>
              <div className="note-box">{inv.remarks}</div>
            </section>
          )}
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <section className="card card-pad">
            <div className="card-title" style={{ marginBottom: 10 }}>Invoice Details</div>
            <Kv k="Invoice number" v={inv.invoiceNo} mono />
            <Kv k="Client" v={inv.clientName} />
            <Kv k="Invoice date" v={fmtLong(inv.raisedOn)} />
            <Kv k="Due date" v={fmtLong(inv.dueDate)} />
            <Kv k="Terms" v={`Net ${inv.termDays || 30}`} />
            <Kv k="Payment method" v={inv.paymentMode} />
            <Kv k="Currency" v={inv.currency} />
            <Kv k={`Value in ${base}`} v={compact(inv.base, base)} mono />
          </section>

          <section className="card card-pad">
            <div className="card-title" style={{ marginBottom: 10 }}>Payment</div>
            <Kv k="Withholding" v={inv.taxRate ? `${inv.taxRate}% · ${money(inv.taxAmount, inv.currency)}` : "None"} mono />
            <Kv k="Amount received" v={settled ? money(inv.receivedAmount, inv.currency) : "—"} mono />
            <Kv k="Received date" v={inv.receivedOn ? fmtLong(inv.receivedOn) : "—"} />
            <Kv k="Collection status" v={inv.status} />
            <Kv
              k="Unreconciled"
              v={settled ? money(inv.amount - inv.taxAmount - inv.receivedAmount, inv.currency) : "—"}
              mono
              tone={settled && Math.abs(inv.amount - inv.taxAmount - inv.receivedAmount) > 0.005 ? "neg" : ""}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

const Kv = ({ k, v, mono, tone }) => (
  <div className="kv">
    <span className="kv-k">{k}</span>
    <span className={`kv-v ${mono ? "mono" : ""} ${tone || ""}`}>{v}</span>
  </div>
);
