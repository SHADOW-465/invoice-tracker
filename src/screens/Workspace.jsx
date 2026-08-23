import React, { useEffect, useMemo, useState } from "react";
import { Badge, Empty } from "../components/ui";
import { RowMenu } from "../components/RowMenu";
import { aging, byMonth, monthKeys, totals } from "../lib/derive";
import { compact, fmtDate, fmtLong, money, MONTHS } from "../lib/format";
import { exportCsv, invoiceRowsForExport, invoicePdf, reminderText } from "../lib/exporters";

const STATUSES = ["All", "Received", "Outstanding", "Overdue"];
const RANGES = { "6M": 6, "12M": 12, "24M": 24 };
const ANALYTICS_KEY = "financeos.analyticsOpen";

const SORTS = {
  invoiceNo: (a, b) => a.invoiceNo.localeCompare(b.invoiceNo),
  clientName: (a, b) => a.clientName.localeCompare(b.clientName),
  base: (a, b) => a.base - b.base,
  raisedOn: (a, b) => a.raisedOn.localeCompare(b.raisedOn),
  dueDate: (a, b) => a.dueDate.localeCompare(b.dueDate),
  status: (a, b) => a.status.localeCompare(b.status)
};

/**
 * The home screen: everything the day-to-day job needs on one page — headline numbers,
 * optional analytics, and the full ledger with per-row actions. The deeper screens
 * (collections, client profiles, payments, reports) exist for the work that genuinely
 * benefits from its own room, and are reachable from the top bar and from these rows.
 */
export function Workspace({ ctx }) {
  const { list, base } = ctx;

  const [showAnalytics, setShowAnalytics] = useState(
    () => localStorage.getItem(ANALYTICS_KEY) !== "0"
  );
  useEffect(() => localStorage.setItem(ANALYTICS_KEY, showAnalytics ? "1" : "0"), [showAnalytics]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [currency, setCurrency] = useState("All");
  const [month, setMonth] = useState("All");
  const [client, setClient] = useState("All");
  const [sort, setSort] = useState({ key: "raisedOn", dir: -1 });

  const t = useMemo(() => totals(list), [list]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list
      .filter((i) => status === "All" || i.status === status)
      .filter((i) => currency === "All" || i.currency === currency)
      .filter((i) => month === "All" || i.month === month)
      .filter((i) => client === "All" || i.clientName === client)
      .filter((i) => !q ||
        i.invoiceNo.toLowerCase().includes(q) ||
        i.clientName.toLowerCase().includes(q) ||
        (i.remarks || "").toLowerCase().includes(q) ||
        String(i.amount).includes(q))
      .sort((a, b) => SORTS[sort.key](a, b) * sort.dir);
  }, [list, search, status, currency, month, client, sort]);

  // Whether a filter is *set*, not whether it happened to remove rows — filtering to
  // a month that contains everything is still a filter, and still wants a way out.
  const filtered =
    !!search.trim() || status !== "All" || currency !== "All" || month !== "All" || client !== "All";
  const shown = useMemo(() => totals(rows), [rows]);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === "raisedOn" || key === "base" ? -1 : 1 }));
  const arrow = (key) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  const clearFilters = () => {
    setSearch(""); setStatus("All"); setCurrency("All"); setMonth("All"); setClient("All");
  };

  const exportRows = () => {
    try {
      exportCsv(invoiceRowsForExport(rows, base), `FinanceOS ledger ${new Date().toISOString().slice(0, 10)}.csv`);
      ctx.fire(`Exported ${rows.length} invoices to CSV`);
    } catch (e) {
      ctx.fire(e.message, "error");
    }
  };

  const copyReminder = async (inv) => {
    const { subject, body } = reminderText(inv, ctx.settings);
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      ctx.fire(`Reminder for ${inv.invoiceNo} copied to clipboard`);
    } catch {
      ctx.fire("Clipboard blocked by the browser", "error");
    }
  };

  const menuFor = (inv) => [
    { label: "Open", glyph: "→", onClick: () => ctx.go("invoice", { invoiceNo: inv.invoiceNo }) },
    { label: "Edit invoice", glyph: "✎", onClick: () => ctx.editInvoice(inv) },
    inv.status !== "Received" && { label: "Record payment", glyph: "✓", onClick: () => ctx.recordPayment(inv) },
    { label: "Duplicate", glyph: "⧉", onClick: () => ctx.duplicateInvoice(inv) },
    { label: "Download PDF", glyph: "⤓", onClick: () => invoicePdf(inv, ctx.settings) },
    { label: "Copy reminder", glyph: "✉", onClick: () => copyReminder(inv) },
    { label: "Delete", glyph: "✕", danger: true, onClick: () => ctx.deleteInvoice(inv.invoiceNo) }
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1>Workspace</h1>
          <div className="sub">Your receivables, collections and cash position — and the ledger itself.</div>
        </div>
        <div className="row">
          <button className="btn" onClick={exportRows}>Export CSV</button>
          <button className="btn" onClick={() => setShowAnalytics((v) => !v)} aria-expanded={showAnalytics}>
            {showAnalytics ? "Hide analytics" : "Show analytics"}
          </button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Total Invoiced" value={compact(t.invoiced, base)}
          support={`${list.length} invoices across ${new Set(list.map((i) => i.currency)).size || 0} currencies`} />
        <Kpi label="Collected" value={compact(t.collected, base)} support={lastReceipt(list)} />
        <Kpi label="Outstanding" value={compact(t.outstanding, base)}
          support={`${t.openCount} open ${t.openCount === 1 ? "invoice" : "invoices"} awaiting payment`} />
        <Kpi label="Overdue" value={compact(t.overdue, base)} tone={t.overdue ? "neg" : ""}
          support={t.overdueCount ? `Oldest is ${t.oldestOverdue} days past due` : "Nothing past terms"} />
        <Kpi label="Collection Rate" value={`${t.collectionRate.toFixed(1)}%`}
          support={t.avgDaysToCollect ? `Median time to pay is ${t.avgDaysToCollect} days` : "No settled invoices yet"} />
      </div>

      {showAnalytics && <Analytics ctx={ctx} />}

      <section className="card ledger">
        <div className="ledger-bar">
          <div className="search">
            <span>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices, clients, remarks…" />
          </div>

          <div className="seg">
            {STATUSES.map((f) => (
              <button key={f} className={status === f ? "on" : ""} onClick={() => setStatus(f)}>{f}</button>
            ))}
          </div>

          <select className="select slim" value={currency} onChange={(e) => setCurrency(e.target.value)}
            aria-label="Filter by invoice currency">
            <option value="All">All currencies</option>
            {[...new Set(list.map((i) => i.currency))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select className="select slim" value={month} onChange={(e) => setMonth(e.target.value)}
            aria-label="Filter by invoiced month">
            <option value="All">All months</option>
            {MONTHS.filter((m) => list.some((i) => i.month === m)).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <select className="select slim" value={client} onChange={(e) => setClient(e.target.value)}
            aria-label="Filter by client">
            <option value="All">All clients</option>
            {ctx.clients.map((c) => <option key={c.name} value={c.name}>{c.fullName || c.name}</option>)}
          </select>

          {filtered && <button className="btn btn-sm" onClick={clearFilters}>Clear</button>}

          <div className="spacer" />
          <div className="ledger-count">
            {rows.length} of {list.length} · <span className="mono">{compact(shown.invoiced, base)}</span>
          </div>
        </div>

        <div className="thead ledger-grid">
          <div className="sortable col-no" onClick={() => toggleSort("invoiceNo")}>Invoice{arrow("invoiceNo")}</div>
          <div className="sortable" onClick={() => toggleSort("clientName")}>Client{arrow("clientName")}</div>
          <div className="sortable right" onClick={() => toggleSort("base")}>Amount{arrow("base")}</div>
          <div className="sortable col-raised" onClick={() => toggleSort("raisedOn")}>Raised{arrow("raisedOn")}</div>
          <div className="sortable col-due" onClick={() => toggleSort("dueDate")}>Due{arrow("dueDate")}</div>
          <div className="sortable" onClick={() => toggleSort("status")}>Status{arrow("status")}</div>
          <div className="col-mode">Payment</div>
          <div />
        </div>

        {rows.map((i) => (
          <div key={i.invoiceNo} className="trow ledger-grid"
            onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && ctx.go("invoice", { invoiceNo: i.invoiceNo })}>
            <div className="mono col-no">{i.invoiceNo}</div>
            <div className="truncate" title={i.remarks || undefined}>
              {i.clientName}
              <div className="sub-line mono only-narrow">{i.invoiceNo}</div>
              {i.remarks && <div className="sub-line truncate">{i.remarks}</div>}
            </div>
            <div className="right">
              <div className="mono">{money(i.amount, i.currency)}</div>
              {i.currency !== base && <div className="sub-line">≈ {compact(i.base, base)}</div>}
            </div>
            <div className="num muted col-raised">{fmtDate(i.raisedOn)}</div>
            <div className={`num col-due ${i.status === "Overdue" ? "neg" : "muted"}`}>{fmtDate(i.dueDate)}</div>
            <div>
              <Badge status={i.status} />
              {i.status === "Overdue" && <div className="sub-line neg">{i.overdueDays}d late</div>}
            </div>
            <div className="muted truncate col-mode">{i.paymentMode}</div>
            <RowMenu items={menuFor(i)} label={`Actions for ${i.invoiceNo}`} />
          </div>
        ))}

        {!rows.length && (
          <Empty
            title={list.length ? "No invoices match this view" : "No invoices yet"}
            sub={list.length ? "Try a different filter or search term." : "Create your first invoice to get started."}
          />
        )}
      </section>
    </div>
  );
}

/** Chart, aging and the overdue queue — collapsible, because most days you want the ledger. */
function Analytics({ ctx }) {
  const { list, base } = ctx;
  const [range, setRange] = useState("12M");
  const [metric, setMetric] = useState("Amount");
  const [hover, setHover] = useState(null);

  const buckets = useMemo(() => aging(list), [list]);
  const series = useMemo(() => byMonth(list, monthKeys(list, RANGES[range])), [list, range]);
  const t = useMemo(() => totals(list), [list]);

  const values = series.map((m) => (metric === "Amount" ? m.invoiced : m.count));
  const peak = Math.max(1, ...values);
  // Invoice counts want whole numbers on the axis: a peak of 5 across four gridlines
  // would otherwise read 5 / 3.75 / 2.5 / 1.25, rounded to a nonsense 5 / 4 / 3 / 1.
  const ceiling =
    metric === "Amount"
      ? Math.pow(10, Math.floor(Math.log10(peak))) * Math.ceil(peak / Math.pow(10, Math.floor(Math.log10(peak))))
      : Math.max(4, Math.ceil(peak / 4) * 4);
  const H = 226;
  // Past a dozen columns the month labels collide, so thin them to every other or
  // every third; the tooltip still names the exact month on hover.
  const labelEvery = Math.ceil(series.length / 12);

  const attention = list
    .filter((i) => i.status === "Overdue")
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 4);

  const openTotal = list.filter((i) => i.status !== "Received").reduce((a, i) => a + i.base, 0);

  return (
    <div className="analytics">
      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Invoiced vs Collected</div>
              <div className="card-sub">Monthly activity, shown in {base}</div>
            </div>
            <div className="row">
              <div className="seg">
                {Object.keys(RANGES).map((r) => (
                  <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r}</button>
                ))}
              </div>
              <div className="seg">
                {["Amount", "Invoices"].map((m) => (
                  <button key={m} className={metric === m ? "on" : ""} onClick={() => setMetric(m)}>{m}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-legend">
            <span><span className="legend-dot" style={{ background: "var(--accent)" }} />Invoiced</span>
            <span><span className="legend-dot" style={{ background: "var(--accent-soft)" }} />Collected</span>
          </div>

          <div className="chart">
            <div className="chart-body">
              <div className="chart-axis">
                {[4, 3, 2, 1, 0].map((i) => (
                  <div key={i} className="axis-label">
                    {metric === "Amount" ? compact((ceiling * i) / 4, base) : Math.round((ceiling * i) / 4)}
                  </div>
                ))}
              </div>
              <div className={`chart-plot ${series.length > 14 ? "dense" : ""}`}>
                <div className="chart-lines">{[0, 1, 2, 3, 4].map((i) => <div key={i} />)}</div>
                {series.map((m, idx) => {
                  const a = metric === "Amount" ? m.invoiced : m.count;
                  const b = metric === "Amount" ? m.collected : m.collectedCount;
                  const dim = hover !== null && hover !== idx ? 0.45 : 1;
                  return (
                    <div key={m.key} className="bar-col"
                      onMouseEnter={() => setHover(idx)} onMouseLeave={() => setHover(null)}>
                      <div className="bar-pair">
                        <div className="bar bar-a" style={{ height: Math.max(2, (a / ceiling) * H), opacity: dim }} />
                        <div className="bar bar-b" style={{ height: Math.max(2, (b / ceiling) * H), opacity: dim }} />
                      </div>
                      <div className="bar-label">{idx % labelEvery === 0 ? m.label : " "}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {hover !== null && series[hover] && (
              <div
                className="tooltip"
                style={{
                  left: `clamp(0px, calc(${((hover + 0.5) / series.length) * 100}% - 93px + 64px), calc(100% - 186px))`
                }}
              >
                <div className="tooltip-title">{series[hover].label} {series[hover].year}</div>
                <div className="tooltip-row">
                  <span>Invoiced</span>
                  <b>{metric === "Amount" ? compact(series[hover].invoiced, base) : `${series[hover].count} inv`}</b>
                </div>
                <div className="tooltip-row">
                  <span>Collected</span>
                  <b>{metric === "Amount" ? compact(series[hover].collected, base) : `${series[hover].collectedCount} inv`}</b>
                </div>
                <div className="tooltip-row">
                  <span>Collection rate</span>
                  <b>{series[hover].invoiced ? `${((series[hover].collected / series[hover].invoiced) * 100).toFixed(0)}%` : "—"}</b>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-title">Receivables Aging</div>
          <div className="card-sub">
            {compact(openTotal, base)} outstanding across {list.filter((i) => i.status !== "Received").length} invoices
          </div>
          <div className="aging-bar">
            {buckets.map((b) => (
              <div key={b.label} style={{ flex: Math.max(0.02, b.pct), background: b.color, minWidth: b.amount ? 6 : 0 }} />
            ))}
          </div>
          {buckets.map((b) => (
            <div key={b.label} className="aging-row">
              <span className="aging-dot" style={{ background: b.color }} />
              <span style={{ flex: 1 }}>{b.label}</span>
              <span className="dim">{b.count} inv</span>
              <span className="dim num" style={{ width: 38, textAlign: "right" }}>{b.pct.toFixed(0)}%</span>
              <span className={`mono ${b.label === "90+ days" && b.amount ? "neg" : ""}`} style={{ width: 96, textAlign: "right" }}>
                {compact(b.amount, base)}
              </span>
            </div>
          ))}
        </section>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Needs Your Attention</div>
            <div className="card-sub">
              {attention.length
                ? `${t.overdueCount} overdue ${t.overdueCount === 1 ? "invoice" : "invoices"} worth ${compact(t.overdue, base)}`
                : "Nothing past its terms"}
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => ctx.go("collections")}>All collections</button>
        </div>
        {attention.map((i) => (
          <div key={i.invoiceNo} className="attention-row">
            <div className="priority-bar" style={{ background: i.overdueDays > 60 ? "#A8382F" : i.overdueDays > 20 ? "#C8862B" : "#9AA6B2" }} />
            <div style={{ minWidth: 0 }}>
              <button className="link-btn" onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}>{i.invoiceNo}</button>
              <div className="sub-line truncate">{i.clientName}</div>
            </div>
            <div className="right">
              <div className="mono">{money(i.amount, i.currency)}</div>
              {i.currency !== base && <div className="sub-line">≈ {compact(i.base, base)}</div>}
            </div>
            <div>
              <Badge status={i.status} />
              <div className="sub-line">{i.overdueDays} days ago</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm btn-primary" onClick={() => ctx.recordPayment(i)}>Record Payment</button>
              <button className="btn btn-sm" onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}>→</button>
            </div>
          </div>
        ))}
        {!attention.length && <Empty title="No overdue invoices" sub="You're all caught up." />}
      </section>
    </div>
  );
}

const Kpi = ({ label, value, support, tone }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className={`kpi-value ${tone || ""}`}>{value}</div>
    <div className="kpi-support">{support}</div>
  </div>
);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function lastReceipt(list) {
  const latest = list.filter((i) => i.receivedOn).sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))[0];
  return latest ? `Last receipt ${fmtLong(latest.receivedOn)}` : "No receipts recorded yet";
}
