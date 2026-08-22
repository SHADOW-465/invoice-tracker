import React, { useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Percent,
  CalendarCheck,
  BarChart3,
  PieChart,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Wallet
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

  // Overall health assessment
  const hasOverdue = metrics.totalOverdueBase > 0;
  const collectionRatio = metrics.totalInvoicedBase > 0 
    ? Math.min(100, Math.round((metrics.totalReceivedBase / metrics.totalInvoicedBase) * 100))
    : 0;

  return (
    <div className="bento-wrapper">
      {/* 1. Header Line with View Mode Toggle */}
      <div className="bento-header-bar">
        <div className="bento-header-title">
          <Wallet size={15} color="var(--brand-primary)" />
          <span>Executive Overview & Receivables</span>
          <span className="bento-currency-tag">Base: {store.baseCurrency}</span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggleAnalytics}
          aria-expanded={showAnalytics}
          title={showAnalytics ? "Collapse deep analytics" : "Expand deep analytics"}
        >
          <BarChart3 size={13} />
          <span>{showAnalytics ? "Compact Bento" : "Expanded Bento"}</span>
          {showAnalytics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* 2. Main Bento Grid */}
      <div className="bento-grid">
        {/* BENTO CARD 1: Hero Realized Cash Flow & Collection Rate (Span 7) */}
        <div className="bento-card bento-card-hero">
          <div className="bento-card-header">
            <div className="bento-card-label-group">
              <span className="bento-card-label">Realized Cash Flow</span>
              <span className="bento-badge bento-badge-success">
                <CheckCircle2 size={11} />
                <span>{metrics.collectionRate}% Realized</span>
              </span>
            </div>
            <div className="bento-icon-badge bento-icon-success">
              <TrendingUp size={16} />
            </div>
          </div>

          <div className="bento-hero-body">
            <div className="bento-primary-value mono-num">
              {formatCurrency(metrics.totalReceivedBase, store.baseCurrency)}
            </div>
            <div className="bento-hero-subtext">
              <span>Total gross invoiced: </span>
              <strong className="mono-num" style={{ color: "var(--ink-primary)" }}>
                {formatCurrency(metrics.totalInvoicedBase, store.baseCurrency)}
              </strong>
              <span> across {store.invoices.length} invoices</span>
            </div>

            {/* Collection Progress Bar */}
            <div className="bento-progress-track" title={`Realized: ${metrics.collectionRate}%`}>
              <div
                className="bento-progress-fill bento-fill-success"
                style={{ width: `${collectionRatio}%` }}
              />
              {metrics.totalPendingBase > 0 && (
                <div
                  className="bento-progress-fill bento-fill-pending"
                  style={{
                    width: `${Math.min(
                      100 - collectionRatio,
                      Math.round((metrics.totalPendingBase / (metrics.totalInvoicedBase || 1)) * 100)
                    )}%`
                  }}
                />
              )}
            </div>

            {/* Micro Sub-Stats Grid */}
            <div className="bento-subgrid">
              <div className="bento-substat">
                <span className="bento-substat-label">Tax Withheld / TDS</span>
                <span className="bento-substat-value mono-num">
                  {formatCurrency(metrics.totalTaxWithheldBase, store.baseCurrency)}
                </span>
              </div>
              <div className="bento-substat">
                <span className="bento-substat-label">Settled Invoices</span>
                <span className="bento-substat-value mono-num">
                  {store.invoices.filter((i) => i.status === "Received").length} / {store.invoices.length}
                </span>
              </div>
              <div className="bento-substat">
                <span className="bento-substat-label">Avg DSO Speed</span>
                <span className="bento-substat-value mono-num">
                  {metrics.avgDaysToCollect} <small style={{ fontWeight: 500 }}>days</small>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BENTO CARD 2: Receivables & Aging Risk Exposure (Span 5) */}
        <div className="bento-card bento-card-risk">
          <div className="bento-card-header">
            <div className="bento-card-label-group">
              <span className="bento-card-label">Receivables & Aging</span>
              {hasOverdue ? (
                <span className="bento-badge bento-badge-danger">
                  <AlertCircle size={11} />
                  <span>Action Required</span>
                </span>
              ) : (
                <span className="bento-badge bento-badge-neutral">
                  <ShieldCheck size={11} />
                  <span>Healthy Ledger</span>
                </span>
              )}
            </div>
            <div className={`bento-icon-badge ${hasOverdue ? "bento-icon-danger" : "bento-icon-neutral"}`}>
              <Clock size={16} />
            </div>
          </div>

          <div className="bento-risk-body">
            {/* Active Pending */}
            <div className="bento-stat-row">
              <div>
                <div className="bento-stat-subtitle">Active Pending</div>
                <div className="bento-stat-amount mono-num" style={{ color: "var(--status-pending-text)" }}>
                  {formatCurrency(metrics.totalPendingBase, store.baseCurrency)}
                </div>
              </div>
              <span className="bento-status-chip bento-chip-pending">Within Terms</span>
            </div>

            {/* Overdue Past Terms */}
            <div className="bento-stat-row">
              <div>
                <div className="bento-stat-subtitle">Overdue Receivables</div>
                <div className="bento-stat-amount mono-num" style={{ color: hasOverdue ? "var(--status-overdue-text)" : "var(--ink-muted)" }}>
                  {formatCurrency(metrics.totalOverdueBase, store.baseCurrency)}
                </div>
              </div>
              {hasOverdue ? (
                <span className="bento-status-chip bento-chip-danger">Past Due</span>
              ) : (
                <span className="bento-status-chip bento-chip-neutral">$0.00 Overdue</span>
              )}
            </div>

            {/* Aging Buckets Micro Strip */}
            <div className="bento-aging-strip">
              <div className="bento-aging-item">
                <span className="bento-aging-label">0–30d</span>
                <span className="bento-aging-val mono-num">
                  {formatCurrency(metrics.agingBuckets.days1_30, store.baseCurrency)}
                </span>
              </div>
              <div className="bento-aging-item">
                <span className="bento-aging-label">31–60d</span>
                <span className="bento-aging-val mono-num">
                  {formatCurrency(metrics.agingBuckets.days31_60, store.baseCurrency)}
                </span>
              </div>
              <div className="bento-aging-item">
                <span className="bento-aging-label">61–90d+</span>
                <span className="bento-aging-val mono-num">
                  {formatCurrency(metrics.agingBuckets.days61_90 + metrics.agingBuckets.days90Plus, store.baseCurrency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* EXPANDED BENTO ROW: Cash Flow Momentum & Multi-Currency Allocation */}
        {showAnalytics && (
          <>
            {/* BENTO CARD 3: Cash Flow Momentum Trend (Span 7) */}
            <div className="bento-card bento-card-chart">
              <div className="bento-card-header">
                <div className="bento-card-label-group">
                  <span className="bento-card-label">Monthly Velocity: Invoiced vs Collected</span>
                </div>
                <div className="bento-legend-group">
                  <span className="bento-legend-item">
                    <span className="bento-legend-dot bento-dot-invoiced" />
                    Invoiced
                  </span>
                  <span className="bento-legend-item">
                    <span className="bento-legend-dot bento-dot-collected" />
                    Collected
                  </span>
                </div>
              </div>

              {metrics.monthlyData.length === 0 ? (
                <div className="bento-empty-chart">No invoice activity recorded</div>
              ) : (
                <div className="bento-chart-container">
                  {metrics.monthlyData.map((item, idx) => {
                    const invoicedHeight = Math.max(6, (item.invoiced / maxMonthlyVal) * 110);
                    const receivedHeight = Math.max(6, (item.received / maxMonthlyVal) * 110);

                    return (
                      <div key={idx} className="bento-chart-col">
                        <div className="bento-bars-pair">
                          <div
                            className="bento-bar bento-bar-invoiced"
                            style={{ height: `${invoicedHeight}px` }}
                            title={`Invoiced: ${formatCurrency(item.invoiced, store.baseCurrency)}`}
                          />
                          <div
                            className="bento-bar bento-bar-collected"
                            style={{ height: `${receivedHeight}px` }}
                            title={`Collected: ${formatCurrency(item.received, store.baseCurrency)}`}
                          />
                        </div>
                        <span className="bento-chart-label">{item.month.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BENTO CARD 4: Multi-Currency Allocation (Span 5) */}
            <div className="bento-card bento-card-currency">
              <div className="bento-card-header">
                <div className="bento-card-label-group">
                  <span className="bento-card-label">Portfolio Currencies</span>
                </div>
                <span className="bento-pill-count">{currencyEntries.length} Active UOMs</span>
              </div>

              <div className="bento-currency-list">
                {currencyEntries.map(([code, stats]) => (
                  <div key={code} className="bento-currency-row">
                    <div className="bento-currency-info">
                      <strong className="bento-currency-code">{code}</strong>
                      <span className="bento-currency-count">{stats.count} inv</span>
                    </div>
                    <div className="bento-currency-val mono-num">
                      {formatCurrency(stats.total, code)}
                    </div>
                  </div>
                ))}

                {currencyEntries.length === 0 && (
                  <div className="bento-empty-chart">No currencies active</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
