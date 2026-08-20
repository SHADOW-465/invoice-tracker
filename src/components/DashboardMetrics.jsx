import React, { useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Percent,
  CalendarCheck,
  BarChart2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { calculateFinancialMetrics, formatCurrency } from "../utils/calculations";

export function DashboardMetrics({ store, showAnalytics, onToggleAnalytics }) {
  const metrics = useMemo(() => {
    return calculateFinancialMetrics(store.invoices, store.baseCurrency);
  }, [store.invoices, store.baseCurrency]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* 1. Header Line with Analytics Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-muted)" }}>
          Financial Overview ({store.baseCurrency})
        </h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggleAnalytics}
          style={{ fontSize: "0.7rem", color: "var(--ink-secondary)" }}
        >
          <BarChart2 size={13} />
          <span>{showAnalytics ? "Hide Analytics" : "Show Analytics"}</span>
          {showAnalytics ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* 2. Compact KPI Strip */}
      <section className="metrics-strip" aria-label="Executive Financial Overview">
        {/* Total Invoiced */}
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Total Invoiced</span>
            <FileText size={14} color="var(--ink-muted)" />
          </div>
          <div className="metric-tile-val mono-num">
            {formatCurrency(metrics.totalInvoicedBase, store.baseCurrency)}
          </div>
          <div className="metric-tile-sub">
            <span>{store.invoices.length} invoices issued</span>
          </div>
        </div>

        {/* Collected Net */}
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Collected (Net)</span>
            <CheckCircle2 size={14} color="var(--status-received-text)" />
          </div>
          <div className="metric-tile-val mono-num" style={{ color: "var(--status-received-text)" }}>
            {formatCurrency(metrics.totalReceivedBase, store.baseCurrency)}
          </div>
          <div className="metric-tile-sub">
            <span>{metrics.collectionRate}% realized cash flow</span>
          </div>
        </div>

        {/* Pending Balance */}
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Pending</span>
            <Clock size={14} color="var(--status-pending-text)" />
          </div>
          <div className="metric-tile-val mono-num" style={{ color: "var(--status-pending-text)" }}>
            {formatCurrency(metrics.totalPendingBase, store.baseCurrency)}
          </div>
          <div className="metric-tile-sub">
            <span>Within payment terms</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Overdue</span>
            <AlertCircle size={14} color="var(--status-overdue-text)" />
          </div>
          <div className="metric-tile-val mono-num" style={{ color: "var(--status-overdue-text)" }}>
            {formatCurrency(metrics.totalOverdueBase, store.baseCurrency)}
          </div>
          <div className="metric-tile-sub">
            <span>Action required</span>
          </div>
        </div>

        {/* Tax Deducted / Withheld */}
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Tax Withheld / TDS</span>
            <Percent size={14} color="var(--ink-muted)" />
          </div>
          <div className="metric-tile-val mono-num">
            {formatCurrency(metrics.totalTaxWithheldBase, store.baseCurrency)}
          </div>
          <div className="metric-tile-sub">
            <span>Deductions reconciled</span>
          </div>
        </div>

        {/* DSO */}
        <div className="metric-tile">
          <div className="metric-tile-header">
            <span className="metric-tile-label">Avg DSO</span>
            <CalendarCheck size={14} color="var(--ink-muted)" />
          </div>
          <div className="metric-tile-val mono-num">
            {metrics.avgDaysToCollect} <span style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>Days</span>
          </div>
          <div className="metric-tile-sub">
            <span>Average turnaround</span>
          </div>
        </div>
      </section>
    </div>
  );
}
