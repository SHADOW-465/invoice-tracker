import React, { useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Receipt,
  Percent,
  Timer
} from "lucide-react";
import { calculateFinancialMetrics, formatCurrency } from "../utils/calculations";

export function DashboardMetrics({ store, showAnalytics, onToggleAnalytics }) {
  const metrics = useMemo(() => {
    return calculateFinancialMetrics(store.invoices, store.baseCurrency);
  }, [store.invoices, store.baseCurrency]);

  const currencyEntries = useMemo(() => {
    return Object.entries(metrics.currencyBreakdown);
  }, [metrics.currencyBreakdown]);

  const maxMonthlyVal = useMemo(() => {
    if (metrics.monthlyData.length === 0) return 1000;
    const maxVal = Math.max(
      ...metrics.monthlyData.map((d) => Math.max(d.invoiced, d.received)),
      100
    );
    return maxVal * 1.15;
  }, [metrics.monthlyData]);

  const totalGross = metrics.totalInvoicedBase || 1;
  const realizedPct = ((metrics.totalReceivedBase / totalGross) * 100).toFixed(1);
  const taxPct = ((metrics.totalTaxWithheldBase / totalGross) * 100).toFixed(1);
  const pendingPct = ((metrics.totalPendingBase / totalGross) * 100).toFixed(1);
  const overduePct = ((metrics.totalOverdueBase / totalGross) * 100).toFixed(1);

  const hasOverdue = metrics.totalOverdueBase > 0;
  const hasPending = metrics.totalPendingBase > 0;
  const settledCount = store.invoices.filter((i) => i.status === "Received").length;
  const overdueCount = store.invoices.filter((i) => {
    if (i.status === "Received") return false;
    const due = i.dueDate ? new Date(i.dueDate) : null;
    return due && due < new Date();
  }).length;

  return (
    <div className="metrics-dashboard-wrapper">
      {/* 1. Header with Base Currency & Analytics Toggle */}
      <div className="metrics-header-row">
        <div className="metrics-header-title">
          <Receipt size={16} className="metrics-header-icon" />
          <span>Executive Financial Summary</span>
          <span className="metrics-currency-indicator">
            Base Currency: <strong>{store.baseCurrency}</strong>
          </span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggleAnalytics}
          aria-expanded={showAnalytics}
          title={showAnalytics ? "Collapse charts" : "Expand velocity charts"}
        >
          <BarChart3 size={13} />
          <span>{showAnalytics ? "Hide Analytics" : "Show Analytics"}</span>
          {showAnalytics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* 2. 4-Column Executive KPI Cards */}
      <div className="kpi-grid">
        {/* KPI 1: Gross Invoiced */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Invoiced</span>
            <div className="kpi-icon-pill kpi-icon-neutral">
              <FileText size={14} />
            </div>
          </div>
          <div className="kpi-value mono-num">
            {formatCurrency(metrics.totalInvoicedBase, store.baseCurrency)}
          </div>
          <div className="kpi-subtext">
            <span>{store.invoices.length} total invoices raised</span>
          </div>
        </div>

        {/* KPI 2: Realized / Collected Cash */}
        <div className="kpi-card kpi-card-highlight">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Collected Cash</span>
            <span className="kpi-badge kpi-badge-success">
              <CheckCircle2 size={11} />
              <span>{metrics.collectionRate}% Realized</span>
            </span>
          </div>
          <div className="kpi-value kpi-value-success mono-num">
            {formatCurrency(metrics.totalReceivedBase, store.baseCurrency)}
          </div>
          <div className="kpi-subtext">
            <span>{settledCount} of {store.invoices.length} invoices settled</span>
          </div>
        </div>

        {/* KPI 3: Outstanding Receivables & Aging Risk */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Outstanding Receivables</span>
            {hasOverdue ? (
              <span className="kpi-badge kpi-badge-danger">
                <AlertCircle size={11} />
                <span>{overdueCount} Overdue</span>
              </span>
            ) : hasPending ? (
              <span className="kpi-badge kpi-badge-pending">
                <Clock size={11} />
                <span>Within Terms</span>
              </span>
            ) : (
              <span className="kpi-badge kpi-badge-neutral">
                <ShieldCheck size={11} />
                <span>Zero Risk</span>
              </span>
            )}
          </div>
          <div className={`kpi-value mono-num ${hasOverdue ? "kpi-value-danger" : hasPending ? "kpi-value-pending" : ""}`}>
            {formatCurrency(metrics.totalPendingBase + metrics.totalOverdueBase, store.baseCurrency)}
          </div>
          <div className="kpi-subtext">
            {hasOverdue ? (
              <span style={{ color: "var(--status-overdue-text)", fontWeight: 600 }}>
                {formatCurrency(metrics.totalOverdueBase, store.baseCurrency)} past due date
              </span>
            ) : (
              <span>All invoices currently up to date</span>
            )}
          </div>
        </div>

        {/* KPI 4: Tax Withheld & DSO Speed */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Tax / TDS Withheld</span>
            <div className="kpi-icon-pill kpi-icon-neutral">
              <Timer size={14} />
            </div>
          </div>
          <div className="kpi-value mono-num">
            {formatCurrency(metrics.totalTaxWithheldBase, store.baseCurrency)}
          </div>
          <div className="kpi-subtext">
            <span>Avg DSO Speed: <strong>{metrics.avgDaysToCollect} days</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Unified Realization Flow Ribbon */}
      <div className="realization-bar-container">
        <div className="realization-bar-header">
          <div className="realization-legend-group">
            <div className="realization-legend-item">
              <span className="realization-dot realization-dot-success" />
              <span>Realized ({realizedPct}%)</span>
            </div>
            {parseFloat(taxPct) > 0 && (
              <div className="realization-legend-item">
                <span className="realization-dot realization-dot-tax" />
                <span>Tax Withheld ({taxPct}%)</span>
              </div>
            )}
            {parseFloat(pendingPct) > 0 && (
              <div className="realization-legend-item">
                <span className="realization-dot realization-dot-pending" />
                <span>Pending ({pendingPct}%)</span>
              </div>
            )}
            {parseFloat(overduePct) > 0 && (
              <div className="realization-legend-item">
                <span className="realization-dot realization-dot-danger" />
                <span>Overdue ({overduePct}%)</span>
              </div>
            )}
          </div>
          <span className="realization-summary-note mono-num">
            Gross Base: {formatCurrency(metrics.totalInvoicedBase, store.baseCurrency)}
          </span>
        </div>

        <div className="realization-track">
          <div
            className="realization-segment realization-segment-success"
            style={{ width: `${realizedPct}%` }}
            title={`Realized Cash: ${formatCurrency(metrics.totalReceivedBase, store.baseCurrency)} (${realizedPct}%)`}
          />
          {parseFloat(taxPct) > 0 && (
            <div
              className="realization-segment realization-segment-tax"
              style={{ width: `${taxPct}%` }}
              title={`Tax Withheld: ${formatCurrency(metrics.totalTaxWithheldBase, store.baseCurrency)} (${taxPct}%)`}
            />
          )}
          {parseFloat(pendingPct) > 0 && (
            <div
              className="realization-segment realization-segment-pending"
              style={{ width: `${pendingPct}%` }}
              title={`Pending: ${formatCurrency(metrics.totalPendingBase, store.baseCurrency)} (${pendingPct}%)`}
            />
          )}
          {parseFloat(overduePct) > 0 && (
            <div
              className="realization-segment realization-segment-danger"
              style={{ width: `${overduePct}%` }}
              title={`Overdue: ${formatCurrency(metrics.totalOverdueBase, store.baseCurrency)} (${overduePct}%)`}
            />
          )}
        </div>
      </div>

      {/* 4. Expandable Analytics Section */}
      {showAnalytics && (
        <div className="analytics-expandable-grid">
          {/* Chart Card */}
          <div className="analytics-card">
            <div className="analytics-card-header">
              <span className="analytics-card-title">Monthly Velocity: Invoiced vs Collected</span>
              <div className="analytics-legend">
                <span className="analytics-legend-item">
                  <span className="analytics-dot" style={{ background: "var(--chart-bar-invoiced)" }} />
                  Invoiced
                </span>
                <span className="analytics-legend-item">
                  <span className="analytics-dot" style={{ background: "var(--chart-bar-collected)" }} />
                  Collected
                </span>
              </div>
            </div>

            {metrics.monthlyData.length === 0 ? (
              <div className="analytics-empty">No invoice activity recorded</div>
            ) : (
              <div className="analytics-chart-container">
                {metrics.monthlyData.map((item, idx) => {
                  const invoicedHeight = Math.max(6, (item.invoiced / maxMonthlyVal) * 110);
                  const receivedHeight = Math.max(6, (item.received / maxMonthlyVal) * 110);

                  return (
                    <div key={idx} className="analytics-chart-col">
                      <div className="analytics-bars-pair">
                        <div
                          className="analytics-bar"
                          style={{
                            height: `${invoicedHeight}px`,
                            backgroundColor: "var(--chart-bar-invoiced)"
                          }}
                          title={`Invoiced: ${formatCurrency(item.invoiced, store.baseCurrency)}`}
                        />
                        <div
                          className="analytics-bar"
                          style={{
                            height: `${receivedHeight}px`,
                            backgroundColor: "var(--chart-bar-collected)"
                          }}
                          title={`Collected: ${formatCurrency(item.received, store.baseCurrency)}`}
                        />
                      </div>
                      <span className="analytics-chart-label">{item.month.slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Currency Allocation Card */}
          <div className="analytics-card">
            <div className="analytics-card-header">
              <span className="analytics-card-title">Portfolio Currency Allocation</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                {currencyEntries.length} Active Currencies
              </span>
            </div>

            <div className="analytics-currency-list">
              {currencyEntries.map(([code, stats]) => (
                <div key={code} className="analytics-currency-row">
                  <div className="analytics-currency-info">
                    <span className={`currency-tag currency-tag-${code.toLowerCase()}`}>
                      {code}
                    </span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      {stats.count} {stats.count === 1 ? "invoice" : "invoices"}
                    </span>
                  </div>
                  <div className="mono-num" style={{ fontWeight: 700, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                    {formatCurrency(stats.total, code)}
                  </div>
                </div>
              ))}

              {currencyEntries.length === 0 && (
                <div className="analytics-empty">No currencies active</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
