import React, { useMemo } from "react";
import { Empty } from "../components/ui";
import { compact, fmtDate, money } from "../lib/format";
import { exportCsv } from "../lib/exporters";

const COLS = "116px minmax(0,1fr) 118px 118px 118px 96px 100px";

export function Payments({ ctx }) {
  const rows = useMemo(
    () =>
      ctx.list
        .filter((i) => i.status === "Received")
        .sort((a, b) => (b.receivedOn || "").localeCompare(a.receivedOn || "")),
    [ctx.list]
  );

  const totalReceived = rows.reduce((a, i) => a + i.receivedBase, 0);
  const totalWithheld = rows.reduce((a, i) => a + (i.amount ? (i.taxAmount * i.base) / i.amount : 0), 0);
  const totalShort = rows.reduce(
    (a, i) => a + (i.amount ? (Math.max(0, i.amount - i.taxAmount - i.receivedAmount) * i.base) / i.amount : 0),
    0
  );

  const exportRows = () => {
    try {
      exportCsv(
        rows.map((i) => ({
          "Invoice #": i.invoiceNo, Client: i.clientName, Invoiced: i.amount, Currency: i.currency,
          "Tax %": i.taxRate, "Tax amount": i.taxAmount, Received: i.receivedAmount,
          "Received on": i.receivedOn, Method: i.paymentMode,
          [`Received (${ctx.base})`]: Math.round(i.receivedBase * 100) / 100
        })),
        `Payments ${new Date().toISOString().slice(0, 10)}.csv`
      );
      ctx.fire(`Exported ${rows.length} payments`);
    } catch (e) {
      ctx.fire(e.message, "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <div className="sub">Every receipt, with the deductions made explicit.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={exportRows}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => ctx.recordPayment(null)}>Record Payment</button>
        </div>
      </div>

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <Stat label={`Collected (${ctx.base})`} value={compact(totalReceived, ctx.base)} />
        <Stat label="Tax withheld" value={compact(totalWithheld, ctx.base)} />
        <Stat label="Unreconciled shortfall" value={compact(totalShort, ctx.base)} tone={totalShort ? "neg" : ""} />
      </div>

      <div className="table">
        <div className="thead" style={{ gridTemplateColumns: COLS }}>
          <div>Invoice</div><div>Client</div>
          <div className="right">Invoiced</div><div className="right">Withheld</div><div className="right">Received</div>
          <div>Received On</div><div>Method</div>
        </div>

        {rows.map((i) => {
          const unreconciled = i.amount - i.taxAmount - i.receivedAmount;
          return (
            <button key={i.invoiceNo} className="trow" style={{ gridTemplateColumns: COLS }}
              onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}>
              <div className="mono">{i.invoiceNo}</div>
              <div className="truncate">{i.clientName}</div>
              <div className="mono right">{money(i.amount, i.currency)}</div>
              <div className={`mono right ${i.taxAmount ? "warn" : "dim"}`}>
                {i.taxAmount ? `−${money(i.taxAmount, i.currency)}` : "—"}
              </div>
              <div className="right">
                <div className="mono">{money(i.receivedAmount, i.currency)}</div>
                {Math.abs(unreconciled) > 0.005 && (
                  <div className="sub-line neg">{unreconciled > 0 ? "short " : "over "}{money(Math.abs(unreconciled), i.currency)}</div>
                )}
              </div>
              <div className="num muted">{fmtDate(i.receivedOn)}</div>
              <div className="muted truncate">{i.paymentMode}</div>
            </button>
          );
        })}

        {!rows.length && <Empty title="No payments recorded yet" sub="Settle an invoice and it appears here." />}
      </div>
    </div>
  );
}

const Stat = ({ label, value, tone }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${tone || ""}`}>{value}</div>
  </div>
);
