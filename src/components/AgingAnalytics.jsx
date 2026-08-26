import React, { useMemo } from "react";
import { AlertCircle, Clock, ShieldAlert, ArrowRight } from "lucide-react";
import { calculateAgingDetails, formatCurrency, formatDate } from "../utils/calculations";

export function AgingAnalytics({ store, onSelectFilter }) {
  const agingData = useMemo(() => {
    return calculateAgingDetails(store.invoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [store.invoices, store.baseCurrency, store.settings?.exchangeRates]);

  const { bucketList, totalOutstanding, totalOverdue, overduePct, criticalInvoices } = agingData;

  return (
    <div className="aging-analytics-grid">
      {/* 1. Aging Buckets Distribution */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <span className="analytics-card-title">Accounts Receivable (AR) Aging</span>
          <span className={`kpi-badge ${totalOverdue > 0 ? "kpi-badge-danger" : "kpi-badge-success"}`}>
            {totalOverdue > 0 ? `${overduePct}% Past Due` : "100% On-Time"}
          </span>
        </div>

        <p className="analytics-card-desc">
          Outstanding receivables grouped by payment due date status ({store.baseCurrency}).
        </p>

        {/* Stacked bar visualization */}
        <div className="aging-stacked-bar">
          {bucketList.map((b) => {
            if (b.amount <= 0) return null;
            return (
              <div
                key={b.key}
                className={`aging-stacked-segment aging-seg-${b.key}`}
                style={{ width: `${b.pct}%` }}
                title={`${b.label}: ${formatCurrency(b.amount, store.baseCurrency)} (${b.pct}%)`}
              />
            );
          })}
        </div>

        {/* Bucket Breakdown Cards */}
        <div className="aging-buckets-list">
          {bucketList.map((b) => (
            <div
              key={b.key}
              className="aging-bucket-row"
              onClick={() => onSelectFilter && onSelectFilter(b.key === "current" ? "Pending" : "Overdue")}
              title="Click to filter table"
            >
              <div className="aging-bucket-info">
                <span className={`aging-indicator-dot aging-dot-${b.key}`} />
                <span className="aging-bucket-name">{b.label}</span>
                <span className="aging-bucket-count">({b.count})</span>
              </div>
              <div className="aging-bucket-values">
                <span className="mono-num aging-bucket-amount">
                  {formatCurrency(b.amount, store.baseCurrency)}
                </span>
                <span className="aging-bucket-pct">{b.pct}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="aging-summary-footer">
          <div>
            <span className="aging-footer-label">Total Outstanding: </span>
            <strong className="mono-num">{formatCurrency(totalOutstanding, store.baseCurrency)}</strong>
          </div>
          <div>
            <span className="aging-footer-label">Overdue Risk: </span>
            <strong className="mono-num" style={{ color: totalOverdue > 0 ? "var(--status-overdue-text)" : "inherit" }}>
              {formatCurrency(totalOverdue, store.baseCurrency)}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Critical Past-Due Invoices / Chasing List */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <span className="analytics-card-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <ShieldAlert size={14} color="var(--status-overdue-text)" />
            <span>Priority Collections & Overdue Balances</span>
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {criticalInvoices.length} Priority Items
          </span>
        </div>

        <p className="analytics-card-desc">
          Highest risk invoices requiring follow-up or payment reminders.
        </p>

        <div className="critical-invoices-list">
          {criticalInvoices.map((inv) => (
            <div key={inv.id} className="critical-invoice-item">
              <div className="critical-invoice-main">
                <div className="critical-invoice-client">
                  <strong>{inv.clientName || "Unnamed Client"}</strong>
                  <span className="critical-invoice-no">#{inv.invoiceNo}</span>
                </div>
                <div className="critical-invoice-dates">
                  <span>Due: {formatDate(inv.dueDate)}</span>
                  <span className="critical-overdue-tag">
                    <Clock size={10} />
                    <span>{inv.overdueDays}d overdue</span>
                  </span>
                </div>
              </div>
              <div className="critical-invoice-amount mono-num">
                {formatCurrency(inv.baseBalance, store.baseCurrency)}
              </div>
            </div>
          ))}

          {criticalInvoices.length === 0 && (
            <div className="analytics-empty-state">
              <span className="empty-state-icon">✨</span>
              <strong>Zero overdue invoices!</strong>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ink-muted)" }}>
                All client receivables are currently within standard payment terms.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
