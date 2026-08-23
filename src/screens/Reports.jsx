import React, { useMemo, useState } from "react";
import { byMonth, clientStats, aging, monthKeys, totals } from "../lib/derive";
import { compact } from "../lib/format";
import { exportCsv, invoiceRowsForExport } from "../lib/exporters";

const RANGES = { "6 months": 6, "12 months": 12, "24 months": 24 };

export function Reports({ ctx }) {
  const { base } = ctx;
  const [rangeLabel, setRangeLabel] = useState("12 months");
  const [client, setClient] = useState("All clients");

  const keys = useMemo(() => monthKeys(ctx.list, RANGES[rangeLabel]), [ctx.list, rangeLabel]);
  const scoped = useMemo(
    () =>
      ctx.list
        .filter((i) => keys.includes(i.raisedOn.slice(0, 7)))
        .filter((i) => client === "All clients" || i.clientName === client),
    [ctx.list, keys, client]
  );

  const t = useMemo(() => totals(scoped), [scoped]);
  const series = useMemo(() => byMonth(scoped, keys), [scoped, keys]);
  const clients = useMemo(() => clientStats(scoped, ctx.clients), [scoped, ctx.clients]);
  const buckets = useMemo(() => aging(scoped), [scoped]);

  const run = (name, rows) => {
    try {
      exportCsv(rows, `${name} — ${rangeLabel}.csv`);
      ctx.fire(`${name} exported (${rows.length} rows)`);
    } catch (e) {
      ctx.fire(e.message, "error");
    }
  };

  const reports = [
    {
      title: "Revenue",
      value: compact(t.invoiced, base),
      desc: "Invoiced value by month, in base currency.",
      spark: series.map((m) => m.invoiced),
      rows: () => series.map((m) => ({ Month: `${m.label} ${m.year}`, Invoices: m.count, [`Invoiced (${base})`]: round(m.invoiced) }))
    },
    {
      title: "Collections",
      value: compact(t.collected, base),
      desc: "Cash received against invoices raised.",
      spark: series.map((m) => m.collected),
      rows: () => series.map((m) => ({
        Month: `${m.label} ${m.year}`,
        [`Invoiced (${base})`]: round(m.invoiced),
        [`Collected (${base})`]: round(m.collected),
        "Collection rate %": m.invoiced ? round((m.collected / m.invoiced) * 100) : 0
      }))
    },
    {
      title: "Outstanding Receivables",
      value: compact(t.outstanding, base),
      desc: "Open balance across all clients.",
      spark: series.map((m) => m.invoiced - m.collected),
      rows: () => invoiceRowsForExport(scoped.filter((i) => i.status !== "Received"), base)
    },
    {
      title: "Aging",
      value: compact(t.overdue, base),
      desc: "Balance sitting beyond agreed terms.",
      spark: buckets.map((b) => b.amount),
      rows: () => buckets.map((b) => ({ Bucket: b.label, Invoices: b.count, [`Amount (${base})`]: round(b.amount), "Share %": round(b.pct) }))
    },
    {
      title: "Client Performance",
      value: `${clients.filter((c) => c.count).length} clients`,
      desc: "Invoiced, collected and reliability per client.",
      spark: clients.slice(0, 8).map((c) => c.invoiced),
      rows: () => clients.filter((c) => c.count).map((c) => ({
        Client: c.fullName || c.name,
        Invoices: c.count,
        [`Invoiced (${base})`]: round(c.invoiced),
        [`Collected (${base})`]: round(c.collected),
        [`Outstanding (${base})`]: round(c.outstanding),
        "Avg days to pay": c.avgDays,
        "On-time %": c.onTimeRate ?? "",
        Behavior: c.behavior.label
      }))
    },
    {
      title: "Payment Timeliness",
      value: t.avgDaysToCollect ? `${t.avgDaysToCollect} days` : "—",
      desc: "Days from invoice raised to cash in, per settled invoice.",
      spark: scoped.filter((i) => i.daysToCollect !== null).slice(-8).map((i) => i.daysToCollect),
      rows: () => scoped.filter((i) => i.daysToCollect !== null).map((i) => ({
        "Invoice #": i.invoiceNo, Client: i.clientName, Raised: i.raisedOn, Due: i.dueDate,
        Received: i.receivedOn, "Days to collect": i.daysToCollect,
        "Within terms": i.receivedOn <= i.dueDate ? "Yes" : "No"
      }))
    }
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <div className="sub">Build, filter and export the numbers your accountant asks for.</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <select className="select" style={{ width: 160 }} value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)}>
          {Object.keys(RANGES).map((r) => <option key={r} value={r}>Last {r}</option>)}
        </select>
        <select className="select" style={{ width: 200 }} value={client} onChange={(e) => setClient(e.target.value)}>
          <option>All clients</option>
          {ctx.clients.map((c) => <option key={c.name} value={c.name}>{c.fullName || c.name}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Display currency">
          {ctx.currencies.map((c) => (
            <button key={c} className={base === c ? "on" : ""} onClick={() => ctx.setBase(c)}>{c}</button>
          ))}
        </div>
        <div className="spacer" />
        <div className="muted" style={{ fontSize: 12 }}>{scoped.length} invoices in scope</div>
      </div>

      <div className="report-grid">
        {reports.map((r) => (
          <button key={r.title} className="card report-card" style={{ textAlign: "left" }}
            onClick={() => run(r.title, r.rows())}>
            <div className="row">
              <div className="card-title">{r.title}</div>
              <div className="spacer" />
              <span className="report-period">Export CSV</span>
            </div>
            <div className="report-value">{r.value}</div>
            <div className="report-desc">{r.desc}</div>
            <Spark values={r.spark} />
          </button>
        ))}
      </div>
    </div>
  );
}

const round = (n) => Math.round(n * 100) / 100;

function Spark({ values }) {
  const peak = Math.max(1, ...values.map((v) => Math.abs(v || 0)));
  return (
    <div className="spark">
      {(values.length ? values : [0]).map((v, i) => (
        <span key={i} style={{ height: `${Math.max(6, (Math.abs(v || 0) / peak) * 100)}%` }} />
      ))}
    </div>
  );
}
