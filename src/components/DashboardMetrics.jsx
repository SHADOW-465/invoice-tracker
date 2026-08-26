import React, { useMemo, useState } from "react";
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
  Timer,
  Users,
  Calendar,
  PieChart
} from "lucide-react";
import { calculateFinancialMetrics, formatCurrency, getEffectiveStatus, calculateAging, isPartiallyPaid, isOnHold, getChartYears, buildChartSeries } from "../utils/calculations";
import { CustomSelect } from "./CustomSelect";
import { TrendChart } from "./TrendChart";
import { AgingAnalytics } from "./AgingAnalytics";
import { ClientPortfolioAnalytics } from "./ClientPortfolioAnalytics";
import { ForecastAnalytics } from "./ForecastAnalytics";

export function DashboardMetrics({ store, showAnalytics, onToggleAnalytics, onShowToast }) {
  const [activeTab, setActiveTab] = useState("trends");

  const metrics = useMemo(() => {
    return calculateFinancialMetrics(store.invoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [store.invoices, store.baseCurrency, store.settings?.exchangeRates]);

  const [chartClient, setChartClient] = useState("all");

  const chartInvoices = useMemo(() => {
    if (chartClient === "all") return store.invoices || [];
    const key = String(chartClient).trim().toLowerCase();
    return (store.invoices || []).filter(
      (inv) => String(inv.clientName || "").trim().toLowerCase() === key
    );
  }, [store.invoices, chartClient]);

  const chartMetrics = useMemo(() => {
    return calculateFinancialMetrics(chartInvoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [chartInvoices, store.baseCurrency, store.settings?.exchangeRates]);

  const currencyEntries = useMemo(() => {
    return Object.entries(metrics.currencyBreakdown || {});
  }, [metrics.currencyBreakdown]);

  // Year-aware, exactly like the standalone analytics chart.
  const [chartYear, setChartYear] = useState("latest");

  const chartYears = useMemo(() => getChartYears(chartMetrics.monthlyData), [chartMetrics.monthlyData]);
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
    () => buildChartSeries(chartMetrics.monthlyData, activeYear),
    [chartMetrics.monthlyData, activeYear]
  );

  const totalGross = metrics.totalInvoicedBase || 1;
  const realizedPct = ((metrics.totalReceivedBase / totalGross) * 100).toFixed(1);
  const taxPct = ((metrics.totalTaxWithheldBase / totalGross) * 100).toFixed(1);
  const pendingPct = ((metrics.totalPendingBase / totalGross) * 100).toFixed(1);
  const overduePct = ((metrics.totalOverdueBase / totalGross) * 100).toFixed(1);

  const hasOverdue = metrics.totalOverdueBase > 0;
  const hasPending = metrics.totalPendingBase > 0;
  const countedInvoices = store.invoices.length - (metrics.voidedCount || 0);
  const settledCount = store.invoices.filter((i) => getEffectiveStatus(i) === "Received").length;
  const overdueCount = store.invoices.filter((i) => {
    if (isOnHold(i.status)) return false;
    if (getEffectiveStatus(i) === "Overdue") return true;
    return isPartiallyPaid(i.status) && calculateAging(i).isOverdue;
  }).length;

  const currentFilter = store.statusFilter;

  const scrollToTable = () => {
    const el = document.getElementById("invoice-ledger-table");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleFilterClick = (filterTarget, label, toastType = "info") => {
    if (store.statusFilter === filterTarget && filterTarget !== "all") {
      store.setStatusFilter("all");
      if (onShowToast) onShowToast("Filter cleared: showing all invoices", "info");
    } else {
      store.setStatusFilter(filterTarget);
      if (onShowToast) onShowToast(label, toastType);
    }
    scrollToTable();
  };

  const handleClientFilter = (clientName) => {
    if (store.clientFilter === clientName) {
      store.setClientFilter("all");
      if (onShowToast) onShowToast("Cleared client filter", "info");
    } else {
      store.setClientFilter(clientName);
      if (onShowToast) onShowToast(`Filtered by client: ${clientName}`, "info");
    }
    scrollToTable();
  };

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
          title={showAnalytics ? "Collapse analytics hub" : "Expand analytics hub"}
        >
          <BarChart3 size={13} />
          <span>{showAnalytics ? "Hide Analytics Hub" : "Financial Analytics Hub"}</span>
          {showAnalytics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* 2. 4-Column Executive KPI Cards (Interactive Filter Triggers) */}
      <div className="kpi-grid">
        {/* KPI 1: Gross Invoiced */}
        <div
          className={`kpi-card kpi-card-interactive ${currentFilter === "all" ? "kpi-card-active" : ""}`}
          onClick={() => handleFilterClick("all", "Showing all invoices", "info")}
          title="Click to view all invoices in table"
        >
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
            <span>
              {countedInvoices} invoices raised
              {metrics.voidedCount > 0 && ` · ${metrics.voidedCount} voided excluded`}
            </span>
          </div>
          {currentFilter === "all" && (
            <div className="kpi-filter-indicator">● Active filter</div>
          )}
        </div>

        {/* KPI 2: Realized / Collected Cash */}
        <div
          className={`kpi-card kpi-card-highlight kpi-card-interactive ${currentFilter === "Received" ? "kpi-card-active" : ""}`}
          onClick={() => handleFilterClick("Received", "Filtered to Collected / Settled invoices", "success")}
          title="Click to filter to Received/Paid invoices"
        >
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
            <span>{settledCount} of {countedInvoices} invoices settled</span>
          </div>
          {currentFilter === "Received" && (
            <div className="kpi-filter-indicator">● Active filter</div>
          )}
        </div>

        {/* KPI 3: Outstanding Receivables & Aging Risk */}
        <div
          className={`kpi-card kpi-card-interactive ${
            currentFilter === "Outstanding" || currentFilter === "Pending" || currentFilter === "Overdue"
              ? "kpi-card-active"
              : ""
          }`}
          onClick={() =>
            handleFilterClick("Outstanding", "Filtered to Outstanding Receivables (Pending & Overdue)", "info")
          }
          title="Click to filter to unpaid/outstanding receivables"
        >
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
          {(currentFilter === "Outstanding" || currentFilter === "Pending" || currentFilter === "Overdue") && (
            <div className="kpi-filter-indicator">● Active filter</div>
          )}
        </div>

        {/* KPI 4: Tax Withheld & DSO Speed */}
        <div
          className={`kpi-card kpi-card-interactive ${currentFilter === "TaxDeducted" ? "kpi-card-active" : ""}`}
          onClick={() => handleFilterClick("TaxDeducted", "Filtered to invoices with Tax / TDS Withholding", "info")}
          title="Click to filter to invoices with tax withholding deductions"
        >
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
          {currentFilter === "TaxDeducted" && (
            <div className="kpi-filter-indicator">● Active filter</div>
          )}
        </div>
      </div>

      {/* 3. Unified Realization Flow Ribbon (Interactive Segment Clicking) */}
      <div className="realization-bar-container">
        <div className="realization-bar-header">
          <div className="realization-legend-group">
            <div
              className={`realization-legend-item realization-legend-item-interactive ${currentFilter === "Received" ? "realization-legend-item-active" : ""}`}
              onClick={() => handleFilterClick("Received", "Filtered to Realized Cash invoices", "success")}
              title="Click to filter to Realized Cash"
            >
              <span className="realization-dot realization-dot-success" />
              <span>Realized ({realizedPct}%)</span>
            </div>
            {parseFloat(taxPct) > 0 && (
              <div
                className={`realization-legend-item realization-legend-item-interactive ${currentFilter === "TaxDeducted" ? "realization-legend-item-active" : ""}`}
                onClick={() => handleFilterClick("TaxDeducted", "Filtered to Tax Withheld invoices", "info")}
                title="Click to filter to Tax Withheld"
              >
                <span className="realization-dot realization-dot-tax" />
                <span>Tax Withheld ({taxPct}%)</span>
              </div>
            )}
            {parseFloat(pendingPct) > 0 && (
              <div
                className={`realization-legend-item realization-legend-item-interactive ${currentFilter === "Pending" ? "realization-legend-item-active" : ""}`}
                onClick={() => handleFilterClick("Pending", "Filtered to Pending invoices", "info")}
                title="Click to filter to Pending invoices"
              >
                <span className="realization-dot realization-dot-pending" />
                <span>Pending ({pendingPct}%)</span>
              </div>
            )}
            {parseFloat(overduePct) > 0 && (
              <div
                className={`realization-legend-item realization-legend-item-interactive ${currentFilter === "Overdue" ? "realization-legend-item-active" : ""}`}
                onClick={() => handleFilterClick("Overdue", "Filtered to Overdue invoices", "error")}
                title="Click to filter to Overdue invoices"
              >
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
            className="realization-segment realization-segment-success realization-segment-interactive"
            style={{ width: `${realizedPct}%` }}
            onClick={() => handleFilterClick("Received", "Filtered to Realized Cash invoices", "success")}
            title={`Realized Cash: ${formatCurrency(metrics.totalReceivedBase, store.baseCurrency)} (${realizedPct}%) — Click to filter`}
          />
          {parseFloat(taxPct) > 0 && (
            <div
              className="realization-segment realization-segment-tax realization-segment-interactive"
              style={{ width: `${taxPct}%` }}
              onClick={() => handleFilterClick("TaxDeducted", "Filtered to Tax Withheld invoices", "info")}
              title={`Tax Withheld: ${formatCurrency(metrics.totalTaxWithheldBase, store.baseCurrency)} (${taxPct}%) — Click to filter`}
            />
          )}
          {parseFloat(pendingPct) > 0 && (
            <div
              className="realization-segment realization-segment-pending realization-segment-interactive"
              style={{ width: `${pendingPct}%` }}
              onClick={() => handleFilterClick("Pending", "Filtered to Pending invoices", "info")}
              title={`Pending: ${formatCurrency(metrics.totalPendingBase, store.baseCurrency)} (${pendingPct}%) — Click to filter`}
            />
          )}
          {parseFloat(overduePct) > 0 && (
            <div
              className="realization-segment realization-segment-danger realization-segment-interactive"
              style={{ width: `${overduePct}%` }}
              onClick={() => handleFilterClick("Overdue", "Filtered to Overdue invoices", "error")}
              title={`Overdue: ${formatCurrency(metrics.totalOverdueBase, store.baseCurrency)} (${overduePct}%) — Click to filter`}
            />
          )}
        </div>
      </div>

      {/* 4. Expandable Advanced Analytics Hub */}
      {showAnalytics && (
        <div className="analytics-hub-container">
          {/* Analytics Hub Sub-navigation */}
          <div className="analytics-tab-bar">
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "trends" ? "is-active" : ""}`}
              onClick={() => setActiveTab("trends")}
            >
              <BarChart3 size={14} />
              <span>Cash Flow Trends</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "aging" ? "is-active" : ""}`}
              onClick={() => setActiveTab("aging")}
            >
              <Clock size={14} />
              <span>AR Aging & Risk</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "clients" ? "is-active" : ""}`}
              onClick={() => setActiveTab("clients")}
            >
              <Users size={14} />
              <span>Client Intelligence</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "forecast" ? "is-active" : ""}`}
              onClick={() => setActiveTab("forecast")}
            >
              <Calendar size={14} />
              <span>Inflow Forecast & Modes</span>
            </button>
          </div>

          {/* TAB 1: Trends & Currency Allocation */}
          {activeTab === "trends" && (
            <div className="analytics-expandable-grid">
              {/* Chart Card */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <span className="analytics-card-title">
                    {activeYear === "all" ? "Yearly" : "Monthly"} amounts: billed vs collected
                    {chartClient !== "all" ? ` · ${chartClient}` : ""}
                  </span>
                  <div className="analytics-legend">
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
                    <span className="analytics-legend-item">
                      <span className="analytics-dot" style={{ background: "var(--chart-bar-invoiced)" }} />
                      Billed
                    </span>
                    <span className="analytics-legend-item">
                      <span className="analytics-dot" style={{ background: "var(--chart-bar-collected)" }} />
                      Collected
                    </span>
                  </div>
                </div>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.68rem", color: "var(--ink-muted)" }}>
                  Amounts in {store.baseCurrency}. Billed uses the invoice date; collected uses the payment date.
                </p>
                <TrendChart series={chartSeries} currency={store.baseCurrency} />
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
                    <div className="analytics-empty">No currencies active</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Accounts Receivable Aging Analysis */}
          {activeTab === "aging" && (
            <AgingAnalytics
              store={store}
              onSelectFilter={(filter) => handleFilterClick(filter, `Filtered to ${filter} invoices`, "info")}
            />
          )}

          {/* TAB 3: Client Portfolio Rankings & Reliability */}
          {activeTab === "clients" && (
            <ClientPortfolioAnalytics
              store={store}
              onSelectClient={handleClientFilter}
            />
          )}

          {/* TAB 4: Inflow Forecast & Settlement Channels */}
          {activeTab === "forecast" && (
            <ForecastAnalytics
              store={store}
              onSelectFilter={(filter) => handleFilterClick(filter, `Filtered to ${filter} invoices`, "info")}
            />
          )}
        </div>
      )}
    </div>
  );
}

