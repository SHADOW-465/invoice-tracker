import React from "react";
import { initialsOf } from "../lib/derive";

const NAV = [
  ["workspace", "Workspace"],
  ["collections", "Collections"],
  ["clients", "Clients"],
  ["payments", "Payments"],
  ["reports", "Reports"]
];

// Detail screens keep their parent tab lit.
const PARENT = { invoice: "workspace", client: "clients" };

export function Topbar({ ctx }) {
  const active = PARENT[ctx.route.screen] || ctx.route.screen;
  const name = ctx.settings.workspaceName || "Workspace";
  const overdue = ctx.all.filter((i) => i.status === "Overdue").length;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={() => ctx.go("workspace")} title="Workspace">
          <span className="brand-mark">F</span>
          <span className="brand-text">
            <span className="brand-name">FinanceOS</span>
            <span className="brand-sub truncate">{name}</span>
          </span>
        </button>

        <nav className="tabs">
          {NAV.map(([key, label]) => (
            <button
              key={key}
              className={`tab ${active === key ? "active" : ""}`}
              onClick={() => ctx.go(key)}
            >
              {label}
              {key === "collections" && overdue > 0 && <span className="tab-dot" title={`${overdue} overdue`} />}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <button className="search-trigger" onClick={ctx.openPalette}>
            <span>⌕</span>
            <span className="search-trigger-label">Search</span>
            <span className="kbd">⌘K</span>
          </button>

          <div className="seg" role="group" aria-label="Display currency" title="Show every total in this currency">
            {ctx.currencies.map((c) => (
              <button key={c} className={ctx.base === c ? "on" : ""} onClick={() => ctx.setBase(c)}>
                {c}
              </button>
            ))}
          </div>

          <button className="btn btn-primary" onClick={ctx.newInvoice}>＋ New Invoice</button>

          <button
            className={`icon-btn round ${active === "settings" ? "on" : ""}`}
            onClick={() => ctx.go("settings")}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>

          <div className="avatar" title={name}>{initialsOf(name)}</div>
        </div>
      </div>
    </header>
  );
}
