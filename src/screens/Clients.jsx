import React, { useMemo } from "react";
import { Empty, Pips } from "../components/ui";
import { clientStats, initialsOf } from "../lib/derive";
import { compact } from "../lib/format";

const COLS = "minmax(0,1.4fr) 116px 116px 116px 74px 92px 150px";

export function Clients({ ctx }) {
  const rows = useMemo(() => clientStats(ctx.list, ctx.clients), [ctx.list, ctx.clients]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <div className="sub">Billing relationships and how reliably each one pays.</div>
        </div>
        <button className="btn btn-primary" onClick={() => ctx.editClient(null)}>＋ New Client</button>
      </div>

      <div className="table">
        <div className="thead" style={{ gridTemplateColumns: COLS }}>
          <div>Client</div>
          <div className="right">Total Invoiced</div>
          <div className="right">Collected</div>
          <div className="right">Outstanding</div>
          <div className="right">Invoices</div>
          <div className="right">Avg. Days</div>
          <div>Payment Behavior</div>
        </div>

        {rows.map((c) => (
          <button key={c.name} className="trow" style={{ gridTemplateColumns: COLS }}
            onClick={() => ctx.go("client", { clientName: c.name })}>
            <div className="client-cell">
              <span className="code-pill">{initialsOf(c.fullName || c.name)}</span>
              <span className="truncate">{c.fullName || c.name}</span>
            </div>
            <div className="mono right">{compact(c.invoiced, ctx.base)}</div>
            <div className="mono right">{compact(c.collected, ctx.base)}</div>
            <div className={`mono right ${c.outstanding ? "neg" : "dim"}`}>
              {c.outstanding ? compact(c.outstanding, ctx.base) : "—"}
            </div>
            <div className="num right muted">{c.count}</div>
            <div className="num right muted">{c.avgDays ? `${c.avgDays} days` : "—"}</div>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ width: 62 }}>
                <Pips n={c.behavior?.pips || 0} color={c.behavior?.color} />
              </div>
              <span className="muted" style={{ fontSize: 12 }}>{c.behavior?.label || "—"}</span>
            </div>
          </button>
        ))}

        {!rows.length && <Empty title="No clients yet" sub="They appear here as soon as you raise an invoice." />}
      </div>
    </div>
  );
}
