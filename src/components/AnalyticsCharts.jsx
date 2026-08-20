import React, { useMemo } from "react";
import { BarChart3, PieChart } from "lucide-react";
import { calculateFinancialMetrics, formatCurrency } from "../utils/calculations";

export function AnalyticsCharts({ store }) {
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

  return (
    <section className="analytics-section" aria-label="Financial Visualizations">
      {/* 1. Monthly Cash Flow Trends */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">
            <BarChart3 size={15} color="var(--brand-primary)" />
            <span>Monthly Invoiced vs Collected ({store.baseCurrency})</span>
          </h3>
          <div style={{ display: "flex", gap: "0.85rem", fontSize: "0.7rem", color: "var(--ink-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--chart-bar-invoiced)" }}></span>
              Invoiced
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--chart-bar-collected)" }}></span>
              Collected
            </span>
          </div>
        </div>

        {metrics.monthlyData.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>
            No invoice data available
          </div>
        ) : (
          <div style={{ height: "150px", display: "flex", alignItems: "flex-end", gap: "1.25rem", padding: "0.5rem 0" }}>
            {metrics.monthlyData.map((item, idx) => {
              const invoicedHeight = Math.max(6, (item.invoiced / maxMonthlyVal) * 120);
              const receivedHeight = Math.max(6, (item.received / maxMonthlyVal) * 120);

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.35rem",
                    height: "100%",
                    justifyContent: "flex-end"
                  }}
                >
                  <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "120px" }}>
                    <div
                      title={`Invoiced: ${formatCurrency(item.invoiced, store.baseCurrency)}`}
                      style={{
                        width: "18px",
                        height: `${invoicedHeight}px`,
                        backgroundColor: "var(--chart-bar-invoiced)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.25s ease"
                      }}
                    />
                    <div
                      title={`Collected: ${formatCurrency(item.received, store.baseCurrency)}`}
                      style={{
                        width: "18px",
                        height: `${receivedHeight}px`,
                        backgroundColor: "var(--chart-bar-collected)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.25s ease"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--ink-secondary)" }}>
                    {item.month.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Currency Breakdown */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">
            <PieChart size={15} color="var(--status-pending-text)" />
            <span>Currency Breakdown</span>
          </h3>
          <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>
            {currencyEntries.length} Currencies
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {currencyEntries.map(([code, stats]) => (
            <div
              key={code}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.4rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                fontSize: "var(--text-xs)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <strong style={{ color: "var(--ink-primary)" }}>{code}</strong>
                <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)", background: "var(--bg-surface-hover)", padding: "1px 4px", borderRadius: "2px" }}>
                  {stats.count}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="mono-num" style={{ fontWeight: 700, color: "var(--ink-primary)" }}>
                  {formatCurrency(stats.total, code)}
                </span>
              </div>
            </div>
          ))}

          {currencyEntries.length === 0 && (
            <div style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", textAlign: "center", padding: "1rem" }}>
              No currencies recorded
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
