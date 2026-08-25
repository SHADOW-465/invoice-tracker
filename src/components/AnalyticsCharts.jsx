import React, { useMemo, useState } from "react";
import { BarChart3, PieChart } from "lucide-react";
import { calculateFinancialMetrics, formatCurrency, getChartYears, buildChartSeries } from "../utils/calculations";

export function AnalyticsCharts({ store }) {
  const metrics = useMemo(() => {
    return calculateFinancialMetrics(store.invoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [store.invoices, store.baseCurrency, store.settings?.exchangeRates]);

  // Which year the monthly chart is showing. "all" rolls the ledger up to one bar
  // per year, which is the only readable way to view a decade of invoices.
  const [chartYear, setChartYear] = useState("latest");

  const chartYears = useMemo(() => getChartYears(metrics.monthlyData), [metrics.monthlyData]);

  const activeYear = chartYear === "latest" ? (chartYears[0] ?? null) : chartYear;

  const chartSeries = useMemo(
    () => buildChartSeries(metrics.monthlyData, activeYear),
    [metrics.monthlyData, activeYear]
  );

  const maxMonthlyVal = useMemo(() => {
    if (chartSeries.length === 0) return 1000;
    const maxVal = Math.max(
      ...chartSeries.map((d) => Math.max(d.invoiced, d.received)),
      100
    );
    return maxVal * 1.15;
  }, [chartSeries]);

  return (
    <section className="analytics-section" aria-label="Financial Visualizations">
      {/* 1. Monthly Cash Flow Trends */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">
            <BarChart3 size={15} color="var(--brand-primary)" />
            <span>
              {activeYear === "all" ? "Yearly" : "Monthly"} Invoiced vs Collected ({store.baseCurrency})
            </span>
          </h3>
          <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", fontSize: "0.7rem", color: "var(--ink-muted)" }}>
            {chartYears.length > 0 && (
              <select
                className="col-filter"
                style={{ width: "auto", minWidth: 96 }}
                value={activeYear === "all" ? "all" : String(activeYear)}
                onChange={(e) => setChartYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                aria-label="Chart period"
              >
                <option value="all">All years</option>
                {chartYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            )}
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

        {chartSeries.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}>
            No invoice data available
          </div>
        ) : (
          <div style={{ height: "150px", display: "flex", alignItems: "flex-end", gap: chartSeries.length > 12 ? "0.35rem" : "1.25rem", padding: "0.5rem 0" }}>
            {chartSeries.map((item, idx) => {
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
                      title={`${item.label} - Invoiced: ${formatCurrency(item.invoiced, store.baseCurrency)} across ${item.count} invoices`}
                      style={{
                        width: "18px",
                        height: `${invoicedHeight}px`,
                        backgroundColor: "var(--chart-bar-invoiced)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.25s ease"
                      }}
                    />
                    <div
                      title={`${item.label} - Collected: ${formatCurrency(item.received, store.baseCurrency)}`}
                      style={{
                        width: "18px",
                        height: `${receivedHeight}px`,
                        backgroundColor: "var(--chart-bar-collected)",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.25s ease"
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--ink-secondary)", whiteSpace: "nowrap" }}>
                    {item.label}
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
