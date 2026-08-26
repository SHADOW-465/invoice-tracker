import React, { useMemo, useState } from "react";
import { BarChart3, PieChart } from "lucide-react";
import { calculateFinancialMetrics, formatCurrency, getChartYears, buildChartSeries } from "../utils/calculations";
import { CustomSelect } from "./CustomSelect";
import { TrendChart } from "./TrendChart";

export function AnalyticsCharts({ store }) {
  const [chartClient, setChartClient] = useState("all");

  const chartInvoices = useMemo(() => {
    if (chartClient === "all") return store.invoices || [];
    const key = String(chartClient).trim().toLowerCase();
    return (store.invoices || []).filter(
      (inv) => String(inv.clientName || "").trim().toLowerCase() === key
    );
  }, [store.invoices, chartClient]);

  const metrics = useMemo(() => {
    return calculateFinancialMetrics(chartInvoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [chartInvoices, store.baseCurrency, store.settings?.exchangeRates]);

  const currencyEntries = useMemo(() => {
    return Object.entries(metrics.currencyBreakdown || {});
  }, [metrics.currencyBreakdown]);

  // Which year the monthly chart is showing. "all" rolls the ledger up to one bar
  // per year, which is the only readable way to view a decade of invoices.
  const [chartYear, setChartYear] = useState("latest");

  const chartYears = useMemo(() => getChartYears(metrics.monthlyData), [metrics.monthlyData]);

  const activeYear = chartYear === "latest" ? (chartYears[0] ?? null) : chartYear;

  const yearOptions = useMemo(() => {
    return [
      { value: "all", label: "All Years" },
      ...chartYears.map((y) => ({ value: String(y), label: String(y) }))
    ];
  }, [chartYears]);

  const clientOptions = useMemo(() => {
    const names = store.availableClients || [];
    return [
      { value: "all", label: "All clients" },
      ...names.map((name) => ({ value: name, label: name }))
    ];
  }, [store.availableClients]);

  const chartSeries = useMemo(
    () => buildChartSeries(metrics.monthlyData, activeYear),
    [metrics.monthlyData, activeYear]
  );

  return (
    <section className="analytics-section" aria-label="Financial Visualizations">
      {/* 1. Monthly Cash Flow Trends */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">
            <BarChart3 size={15} color="var(--brand-primary)" />
            <span>
              {activeYear === "all" ? "Yearly" : "Monthly"} amounts billed vs collected ({store.baseCurrency})
              {chartClient !== "all" ? ` · ${chartClient}` : ""}
            </span>
          </h3>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.7rem", color: "var(--ink-muted)" }}>
            <CustomSelect
              value={chartClient}
              onChange={(val) => {
                setChartClient(val);
                setChartYear("latest");
              }}
              options={clientOptions}
              size="sm"
              searchable
              searchPlaceholder="Search clients"
            />
            {chartYears.length > 0 && (
              <CustomSelect
                value={activeYear === "all" ? "all" : String(activeYear)}
                onChange={(val) => setChartYear(val === "all" ? "all" : Number(val))}
                options={yearOptions}
                size="sm"
              />
            )}
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--chart-bar-invoiced)" }}></span>
              Billed
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--chart-bar-collected)" }}></span>
              Collected
            </span>
          </div>
        </div>
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", color: "var(--ink-muted)" }}>
          Amounts in {store.baseCurrency}. Billed uses the invoice date; collected uses the payment date.
        </p>
        <TrendChart series={chartSeries} currency={store.baseCurrency} />
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className={`currency-tag currency-tag-${code.toLowerCase()}`}>
                  {code}
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--ink-muted)", background: "var(--bg-surface-hover)", padding: "1px 5px", borderRadius: "var(--radius-xs)" }}>
                  {stats.count} {stats.count === 1 ? "invoice" : "invoices"}
                </span>
              </div>
              <div className="analytics-currency-amounts">
                <div className="analytics-currency-metric">
                  <span className="mono-num">{formatCurrency(stats.total, code)}</span>
                  <span className="analytics-currency-metric-label">billed</span>
                </div>
                <div className="analytics-currency-metric is-collected">
                  <span className="mono-num">{formatCurrency(stats.received || 0, code)}</span>
                  <span className="analytics-currency-metric-label">collected</span>
                </div>
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
