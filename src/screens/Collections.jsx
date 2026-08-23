import React from "react";
import { Empty } from "../components/ui";
import { compact, fmtDate, money } from "../lib/format";

const ROW = "minmax(0,1fr) 130px minmax(0,1.1fr) 130px auto";

export function Collections({ ctx }) {
  const { list, base } = ctx;

  const overdue = list.filter((i) => i.status === "Overdue").sort((a, b) => b.overdueDays - a.overdueDays);
  const dueSoon = list.filter((i) => i.status === "Outstanding").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const collected = list
    .filter((i) => i.status === "Received")
    .sort((a, b) => (b.receivedOn || "").localeCompare(a.receivedOn || ""))
    .slice(0, 6);

  const sum = (set, key = "base") => set.reduce((a, i) => a + i[key], 0);

  const groups = [
    { title: "Overdue", subtitle: `${overdue.length} invoices need action today`, color: "#A8382F", rows: overdue, total: sum(overdue), empty: "No overdue invoices" },
    { title: "Due Soon", subtitle: "Approaching their payment deadline", color: "#C8862B", rows: dueSoon, total: sum(dueSoon), empty: "Nothing due soon" },
    { title: "Recently Collected", subtitle: "The most recent cash to land", color: "#2F6B4F", rows: collected, total: sum(collected, "receivedBase"), empty: "No recent collections" }
  ];

  const stages = [
    ["Raised", list.length],
    ["Outstanding", dueSoon.length],
    ["Overdue", overdue.length],
    ["Collected", list.filter((i) => i.status === "Received").length]
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Collections</h1>
          <div className="sub">Turn outstanding invoices into collected cash.</div>
        </div>
        <div className="stat-row">
          <Stat label="Overdue" value={compact(sum(overdue), base)} />
          <Stat label="Due soon" value={compact(sum(dueSoon), base)} />
          <Stat label="Recently collected" value={compact(sum(collected, "receivedBase"), base)} />
        </div>
      </div>

      <div className="card workflow">
        {stages.map(([label, count], idx) => (
          <React.Fragment key={label}>
            <div className="wf-step">
              <div className={`wf-n ${idx < 3 && count ? "on" : ""}`}>{idx + 1}</div>
              <div>
                <div className="wf-label">{label}</div>
                <div className="wf-count">{count} invoices</div>
              </div>
            </div>
            {idx < stages.length - 1 && <span className="wf-arrow">→</span>}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        {groups.map((g) => (
          <section key={g.title} className="card">
            <div className="group-head">
              <span className="group-dot" style={{ background: g.color }} />
              <div className="card-title">{g.title}</div>
              <div className="card-sub" style={{ marginTop: 0 }}>{g.subtitle}</div>
              <div className="spacer" />
              <div className="mono">{compact(g.total, base)}</div>
            </div>

            {g.rows.map((i) => (
              <div key={i.invoiceNo} className="collection-row" style={{ gridTemplateColumns: ROW }}>
                <div style={{ minWidth: 0 }}>
                  <button className="link-btn" onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}>{i.invoiceNo}</button>
                  <div className="sub-line truncate">{i.clientName}</div>
                </div>
                <div className="right">
                  <div className="mono">{money(i.amount, i.currency)}</div>
                  {i.currency !== base && <div className="sub-line">≈ {compact(i.base, base)}</div>}
                </div>
                <div className="muted truncate" style={{ fontSize: 12 }}>
                  {i.remarks || (i.status === "Received" ? "Settled in full" : "No notes yet")}
                </div>
                <div className={i.overdueDays > 0 ? "neg" : "muted"} style={{ fontSize: 12 }}>
                  {i.status === "Received"
                    ? `Paid ${fmtDate(i.receivedOn)}`
                    : i.overdueDays > 0
                    ? `${i.overdueDays} days overdue`
                    : `Due in ${i.daysToDue} days`}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {i.status !== "Received" && (
                    <button className="btn btn-sm btn-primary" onClick={() => ctx.recordPayment(i)}>Record Payment</button>
                  )}
                  <button className="btn btn-sm" onClick={() => ctx.go("invoice", { invoiceNo: i.invoiceNo })}>View</button>
                </div>
              </div>
            ))}

            {!g.rows.length && <Empty title={g.empty} sub="You're all caught up." />}
          </section>
        ))}
      </div>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="stat">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
);
