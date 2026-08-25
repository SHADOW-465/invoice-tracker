import React, { useMemo } from "react";
import { Badge, Empty, Pips } from "../components/ui";
import { clientStats, initialsOf } from "../lib/derive";
import { compact, fmtLong, money } from "../lib/format";

const COLS = "116px 130px 118px 110px";

export function ClientProfile({ ctx }) {
  const rows = useMemo(() => clientStats(ctx.all, ctx.clients), [ctx.all, ctx.clients]);
  const c = rows.find((x) => x.name === ctx.route.clientName);

  if (!c) {
    return (
      <div className="page">
        <button className="back-link" onClick={() => ctx.go("clients")}>← Clients</button>
        <Empty title="Client not found" />
      </div>
    );
  }

  const currencies = [...new Set(c.invoices.map((i) => i.currency))];
  const since = c.invoices.map((i) => i.raisedOn).sort()[0];

  return (
    <div className="page">
      <button className="back-link" onClick={() => ctx.go("clients")}>← Clients</button>

      <div className="page-head">
        <div className="row" style={{ gap: 14 }}>
          <div className="avatar" style={{ width: 40, height: 40, borderRadius: 11, fontSize: 14 }}>
            {initialsOf(c.fullName || c.name)}
          </div>
          <div>
            <h1>{c.fullName || c.name}</h1>
            <div className="sub">
              {c.count} invoices · {currencies.join(", ") || "—"}
              {since ? ` · client since ${fmtLong(since)}` : ""}
              {c.email ? ` · ${c.email}` : ""}
            </div>
          </div>
        </div>
        <button className="btn" onClick={() => ctx.editClient(c)}>Edit client</button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Summary label="Total Invoiced" value={compact(c.invoiced, ctx.base)} sub={`${c.count} invoices raised`} />
        <Summary label="Total Collected" value={compact(c.collected, ctx.base)}
          sub={`${c.invoices.filter((i) => i.receivedOn).length} payments received`} />
        <Summary label="Outstanding" value={compact(c.outstanding, ctx.base)}
          sub={c.outstanding ? "Awaiting payment" : "Fully settled"} />
      </div>

      <div className="detail-grid" style={{ marginTop: 18 }}>
        <section className="card">
          <div className="card-head"><div className="card-title">Invoice History</div></div>
          <div className="thead" style={{ gridTemplateColumns: COLS }}>
            <div>Invoice</div><div className="right">Amount</div><div>Raised</div><div>Status</div>
          </div>
          {c.invoices
            .slice()
            .sort((a, b) => b.raisedOn.localeCompare(a.raisedOn))
            .map((i) => (
              <button key={i.invoiceNo} className="trow" style={{ gridTemplateColumns: COLS }}
                onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}>
                <div className="mono">{i.invoiceNo}</div>
                <div className="mono right">{money(i.amount, i.currency)}</div>
                <div className="num muted">{fmtLong(i.raisedOn)}</div>
                <div><Badge status={i.status} /></div>
              </button>
            ))}
          {!c.invoices.length && <Empty title="No invoices yet" />}
        </section>

        <section className="card card-pad">
          <div className="card-title">Payment Behavior</div>
          <div className="row" style={{ alignItems: "baseline", gap: 8, margin: "14px 0 12px" }}>
            <div className="amount-big" style={{ fontSize: 30 }}>{c.avgDays || "—"}</div>
            <div className="muted" style={{ fontSize: 12 }}>days average to pay</div>
          </div>
          <Pips n={Math.round((c.behavior?.pips || 0) * 1.6)} total={8} color={c.behavior?.color} tall />
          <div className="sub-line" style={{ marginTop: 10, lineHeight: 1.5 }}>{c.behavior?.note || ""}</div>

          <div style={{ marginTop: 18 }}>
            <Kv k="Fastest payment" v={c.fastest !== null ? `${c.fastest} days` : "—"} />
            <Kv k="Slowest payment" v={c.slowest !== null ? `${c.slowest} days` : "—"} />
            <Kv k="On-time rate" v={c.onTimeRate !== null ? `${c.onTimeRate}%` : "—"} />
            <Kv k="Preferred method" v={c.preferredMode} />
            <Kv k="Default terms" v={`Net ${c.termDays || 30}`} />
            {c.taxRate > 0 && <Kv k="Standing withholding" v={`${c.taxRate}%`} />}
          </div>

          {c.notes && <div className="note-box" style={{ marginTop: 16 }}>{c.notes}</div>}
        </section>
      </div>
    </div>
  );
}

const Summary = ({ label, value, sub }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-support">{sub}</div>
  </div>
);

const Kv = ({ k, v }) => (
  <div className="kv"><span className="kv-k">{k}</span><span className="kv-v">{v}</span></div>
);
