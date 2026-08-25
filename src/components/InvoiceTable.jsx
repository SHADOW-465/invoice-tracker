import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  FilterX,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Edit2,
  Copy,
  Trash2,
  AlertTriangle,
  Receipt,
  Check,
  X,
  Sparkles
} from "lucide-react";
import { MONTH_NAMES, calculateAging, formatDate, formatCurrency, getClientColor, getEffectiveStatus, isReceivable } from "../utils/calculations";
import { CURRENCIES } from "../types/finance";
import { CustomSelect } from "./CustomSelect";
import { InlineStatusDropdown } from "./InlineStatusDropdown";
import { InlinePaymentModeDropdown } from "./InlinePaymentModeDropdown";
import { ConfirmDialog } from "./ConfirmDialog";

export function InvoiceTable({
  store,
  onOpenEditInvoice,
  onOpenMarkPaid,
  onOpenPreviewInvoice,
  onShowToast
}) {
  const {
    invoices,
    filteredInvoices,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    currencyFilter,
    setCurrencyFilter,
    monthFilter,
    setMonthFilter,
    yearFilter,
    setYearFilter,
    clientFilter,
    setClientFilter,
    invoiceNoFilter,
    setInvoiceNoFilter,
    paymentModeFilter,
    setPaymentModeFilter,
    agingFilter,
    setAgingFilter,
    taxFilter,
    setTaxFilter,
    settledFilter,
    setSettledFilter,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    availableYears,
    availableCurrencies,
    availableClients,
    availablePaymentModes,
    resetFilters,
    sortField,
    sortDirection,
    setSortField,
    setSortDirection,
    duplicateInvoice,
    deleteInvoice,
    updateInvoice
  } = store;

  // Selected rows for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Per-column filter row visibility
  const [showFilters, setShowFilters] = useState(false);

  // Pagination. A ledger of a few thousand rows cannot be painted in one pass
  // without the whole page stuttering on every keystroke, sort and status change.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    variant: "danger",
    onConfirm: () => {}
  });

  // Count per status for segmented tabs
  // Counted from the shared effective status so every badge agrees with the KPI
  // cards and with the money. Cancelled and Draft are their own buckets and are
  // deliberately excluded from Outstanding - they are not receivables.
  const statusCounts = useMemo(() => {
    const counts = {
      all: invoices.length,
      Received: 0, Pending: 0, Overdue: 0,
      Draft: 0, Cancelled: 0, Outstanding: 0, TaxDeducted: 0
    };
    invoices.forEach((inv) => {
      const eff = getEffectiveStatus(inv);
      if (counts[eff] !== undefined) counts[eff] += 1;
      if (isReceivable(inv)) counts.Outstanding += 1;
      if (Number(inv.taxAmount || 0) > 0 || Number(inv.taxRate || 0) > 0 ||
          /\btds\b|tax|withh/i.test(String(inv.remarks || ""))) {
        counts.TaxDeducted += 1;
      }
    });
    return counts;
  }, [invoices]);

  // Any filter set at all - drives the "Clear" affordance and the filter badge.
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchQuery.trim()) n++;
    if (statusFilter !== "all") n++;
    if (currencyFilter !== "all") n++;
    if (monthFilter !== "all") n++;
    if (yearFilter !== "all") n++;
    if (clientFilter !== "all") n++;
    if (invoiceNoFilter.trim()) n++;
    if (paymentModeFilter !== "all") n++;
    if (agingFilter !== "all") n++;
    if (taxFilter !== "all") n++;
    if (settledFilter !== "all") n++;
    if (amountMin !== "") n++;
    if (amountMax !== "") n++;
    return n;
  }, [searchQuery, statusFilter, currencyFilter, monthFilter, yearFilter, clientFilter,
      invoiceNoFilter, paymentModeFilter, agingFilter, taxFilter, settledFilter, amountMin, amountMax]);

  // Any change to the result set must return to page 1, otherwise a filter that
  // yields 12 rows while sitting on page 20 shows an empty table.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, currencyFilter, monthFilter, yearFilter, clientFilter,
      invoiceNoFilter, paymentModeFilter, agingFilter, taxFilter, settledFilter,
      amountMin, amountMax, sortField, sortDirection, pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, statusFilter, currencyFilter, monthFilter, yearFilter, clientFilter,
      invoiceNoFilter, paymentModeFilter, agingFilter, taxFilter, settledFilter,
      amountMin, amountMax]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedInvoices = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, safePage, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={11} style={{ opacity: 0.3 }} />;
    return sortDirection === "asc" ? <ArrowUp size={11} color="var(--brand-primary)" /> : <ArrowDown size={11} color="var(--brand-primary)" />;
  };

  // Scoped to the rows actually on screen. Selecting several thousand invisible
  // rows and then hitting Delete is not a gesture anyone means to make.
  const toggleSelectAll = (e) => {
    e.stopPropagation();
    const pageIds = pagedInvoices.map((i) => i.id);
    const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };

  const toggleSelectRow = (id, e) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    setConfirmState({
      isOpen: true,
      title: `Delete ${count} selected invoices?`,
      message: `Are you sure you want to permanently delete all ${count} selected invoices from your ledger? This action cannot be undone.`,
      confirmText: `Delete ${count} Invoices`,
      variant: "danger",
      onConfirm: () => {
        selectedIds.forEach((id) => deleteInvoice(id));
        setSelectedIds(new Set());
        onShowToast(`Deleted ${count} invoices`, "delete");
      }
    });
  };

  const handleDelete = (id, invoiceNo) => {
    setConfirmState({
      isOpen: true,
      title: `Delete invoice ${invoiceNo}?`,
      message: `Are you sure you want to delete invoice ${invoiceNo}? This will remove all remittance and ledger history for this record.`,
      confirmText: "Delete Invoice",
      variant: "danger",
      onConfirm: () => {
        deleteInvoice(id);
        onShowToast(`Deleted invoice ${invoiceNo}`, "delete");
      }
    });
  };

  // Built from the currencies actually in the ledger, unioned with the known list.
  // Driving this from CURRENCIES alone meant a currency present in the data but
  // missing from that table - AED, for one - could not be filtered at all.
  const currencyOptions = useMemo(() => {
    const known = new Map(CURRENCIES.map((c) => [c.code, c]));
    const codes = Array.from(new Set([...(availableCurrencies || []), ...known.keys()])).sort();
    return [
      { value: "all", label: "All Currencies" },
      ...codes.map((code) => {
        const meta = known.get(code);
        return {
          value: code,
          label: meta ? `${code} (${meta.symbol.trim()})` : code,
          badge: code,
          sublabel: meta ? meta.name : "No rate configured"
        };
      })
    ];
  }, [availableCurrencies]);

  // Month options for CustomSelect
  const monthOptions = useMemo(() => [
    { value: "all", label: "All Months" },
    ...MONTH_NAMES.map((m) => ({
      value: m,
      label: m
    }))
  ], []);

  // Year options, derived from the ledger. Month alone is ambiguous across a
  // multi-year ledger - "January" previously matched every January on file.
  const yearOptions = useMemo(() => [
    { value: "all", label: "All Years" },
    ...availableYears.map((y) => ({ value: String(y), label: String(y) }))
  ], [availableYears]);

  return (
    <div id="invoice-ledger-table" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.75rem", background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--ink-muted)", fontWeight: 600 }}>Active Ledger File:</span>
            <strong style={{ color: "var(--brand-primary)", fontWeight: 700 }}>{store.activeWorkspace?.name || "Master Ledger"}</strong>
            <span className="kpi-badge kpi-badge-neutral">{invoices.length} invoices</span>
          </div>
        </div>
      {/* 1. Header Toolbar with Segmented Tabs & Filters */}
      <div className="ledger-header-bar">
        {/* Segmented Status Tabs */}
        <div className="segmented-tabs">
          <button
            className={`segmented-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span>All</span>
            <span className="tab-badge">{statusCounts.all}</span>
          </button>
          <button
            className={`segmented-tab-btn ${statusFilter === "Received" ? "active" : ""}`}
            onClick={() => setStatusFilter("Received")}
          >
            <span>Received</span>
            <span className="tab-badge tab-badge-success">{statusCounts.Received}</span>
          </button>
          <button
            className={`segmented-tab-btn ${statusFilter === "Pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("Pending")}
          >
            <span>Pending</span>
            <span className="tab-badge tab-badge-pending">{statusCounts.Pending}</span>
          </button>
          <button
            className={`segmented-tab-btn ${statusFilter === "Overdue" ? "active" : ""}`}
            onClick={() => setStatusFilter("Overdue")}
          >
            <span>Overdue</span>
            <span className="tab-badge tab-badge-overdue">{statusCounts.Overdue}</span>
          </button>
          {statusCounts.Draft > 0 && (
            <button
              className={`segmented-tab-btn ${statusFilter === "Draft" ? "active" : ""}`}
              onClick={() => setStatusFilter(statusFilter === "Draft" ? "all" : "Draft")}
            >
              <span>Draft</span>
              <span className="tab-badge">{statusCounts.Draft}</span>
            </button>
          )}
          {statusCounts.Cancelled > 0 && (
            <button
              className={`segmented-tab-btn ${statusFilter === "Cancelled" ? "active" : ""}`}
              onClick={() => setStatusFilter(statusFilter === "Cancelled" ? "all" : "Cancelled")}
            >
              <span>Cancelled</span>
              <span className="tab-badge">{statusCounts.Cancelled}</span>
            </button>
          )}
          {statusFilter === "Outstanding" && (
            <button
              className="segmented-tab-btn active"
              onClick={() => setStatusFilter("all")}
              title="Click to clear filter and show all"
            >
              <span>Outstanding</span>
              <span className="tab-badge tab-badge-pending">{statusCounts.Outstanding}</span>
              <X size={10} style={{ marginLeft: 2 }} />
            </button>
          )}
          {statusFilter === "TaxDeducted" && (
            <button
              className="segmented-tab-btn active"
              onClick={() => setStatusFilter("all")}
              title="Click to clear filter and show all"
            >
              <span>Tax Withheld</span>
              <span className="tab-badge" style={{ background: "oklch(0.30 0.08 290)", color: "oklch(0.90 0.14 290)" }}>
                {statusCounts.TaxDeducted}
              </span>
              <X size={10} style={{ marginLeft: 2 }} />
            </button>
          )}
        </div>

        {/* Right Search & Filter Controls */}
        <div className="table-controls">
          {/* Search Box */}
          <div className="search-box-refined">
            <Search size={13} className="search-icon-refined" />
            <input
              type="text"
              className="search-input-refined"
              placeholder="Search invoices, clients, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Custom Currency Filter Dropdown */}
          <CustomSelect
            value={currencyFilter}
            onChange={setCurrencyFilter}
            options={currencyOptions}
            size="sm"
          />

          {/* Custom Month Filter Dropdown */}
          <CustomSelect
            value={monthFilter}
            onChange={setMonthFilter}
            options={monthOptions}
            size="sm"
          />

          {/* Year Filter - independent of month */}
          <CustomSelect
            value={yearFilter}
            onChange={setYearFilter}
            options={yearOptions}
            size="sm"
          />

          {/* Per-column filter row toggle */}
          <button
            type="button"
            className={`btn btn-sm ${showFilters ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setShowFilters((v) => !v)}
            title="Filter each column individually"
            aria-expanded={showFilters}
          >
            <Filter size={12} />
            <span>Filters</span>
            {activeFilterCount > 0 && <span className="tab-badge">{activeFilterCount}</span>}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={resetFilters}
              title="Clear every active filter"
            >
              <FilterX size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar (when rows selected) */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
            {selectedIds.size} invoices selected
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={12} />
              <span>Delete Selected</span>
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedIds(new Set())}>
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* 2. Compact High-Precision Data Table */}
      <div className="table-container">
        <div className="table-scroll">
          <table className="data-table-refined">
            <thead>
              <tr>
                <th style={{ width: "38px", textAlign: "center" }}>
                  <label className="custom-checkbox-label" title="Select all invoices on this page">
                    <input
                      type="checkbox"
                      checked={pagedInvoices.length > 0 && pagedInvoices.every((i) => selectedIds.has(i.id))}
                      onChange={toggleSelectAll}
                    />
                    <span className="custom-checkbox-box">
                      {pagedInvoices.length > 0 && pagedInvoices.every((i) => selectedIds.has(i.id)) && (
                        <Check size={11} strokeWidth={3} />
                      )}
                    </span>
                  </label>
                </th>
                <th className="sortable" onClick={() => handleSort("invoiceNo")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span>Invoice #</span>
                    {getSortIcon("invoiceNo")}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("clientName")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span>Client</span>
                    {getSortIcon("clientName")}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("amount")} style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.3rem" }}>
                    <span>Amount</span>
                    {getSortIcon("amount")}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("raisedOn")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span>Raised</span>
                    {getSortIcon("raisedOn")}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("status")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span>Status</span>
                    {getSortIcon("status")}
                  </div>
                </th>
                <th>Payment Mode</th>
                <th className="sortable" onClick={() => handleSort("receivedOn")}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span>Settled On</span>
                    {getSortIcon("receivedOn")}
                  </div>
                </th>
                <th>Due / Aging</th>
                <th>Remarks / Tax Deduction</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>

              {/* Per-column filter row. Each control narrows exactly the column it
                  sits under, and stacks with every other one. */}
              {showFilters && (
                <tr className="column-filter-row">
                  <th />
                  <th>
                    <input
                      type="text"
                      className="col-filter"
                      placeholder="Invoice #"
                      value={invoiceNoFilter}
                      onChange={(e) => setInvoiceNoFilter(e.target.value)}
                      aria-label="Filter by invoice number"
                    />
                  </th>
                  <th>
                    <select
                      className="col-filter"
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                      aria-label="Filter by client"
                    >
                      <option value="all">All clients</option>
                      {availableClients.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </th>
                  <th>
                    <div className="col-filter-range">
                      <input
                        type="number"
                        className="col-filter"
                        placeholder="Min"
                        value={amountMin}
                        onChange={(e) => setAmountMin(e.target.value)}
                        aria-label="Minimum amount"
                      />
                      <input
                        type="number"
                        className="col-filter"
                        placeholder="Max"
                        value={amountMax}
                        onChange={(e) => setAmountMax(e.target.value)}
                        aria-label="Maximum amount"
                      />
                    </div>
                  </th>
                  <th>
                    <div className="col-filter-range">
                      <select
                        className="col-filter"
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        aria-label="Filter by year raised"
                      >
                        <option value="all">Year</option>
                        {availableYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      <select
                        className="col-filter"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        aria-label="Filter by month raised"
                      >
                        <option value="all">Month</option>
                        {MONTH_NAMES.map((m) => <option key={m} value={m}>{m.slice(0, 3)}</option>)}
                      </select>
                    </div>
                  </th>
                  <th>
                    <select
                      className="col-filter"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      aria-label="Filter by status"
                    >
                      <option value="all">All statuses</option>
                      <option value="Received">Received</option>
                      <option value="Pending">Pending</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Outstanding">Outstanding (unpaid)</option>
                      <option value="Draft">Draft</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="TaxDeducted">Tax withheld</option>
                    </select>
                  </th>
                  <th>
                    <select
                      className="col-filter"
                      value={paymentModeFilter}
                      onChange={(e) => setPaymentModeFilter(e.target.value)}
                      aria-label="Filter by payment mode"
                    >
                      <option value="all">All modes</option>
                      {availablePaymentModes.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </th>
                  <th>
                    <select
                      className="col-filter"
                      value={settledFilter}
                      onChange={(e) => setSettledFilter(e.target.value)}
                      aria-label="Filter by settlement"
                    >
                      <option value="all">All</option>
                      <option value="settled">Settled</option>
                      <option value="unsettled">Not settled</option>
                    </select>
                  </th>
                  <th>
                    <select
                      className="col-filter"
                      value={agingFilter}
                      onChange={(e) => setAgingFilter(e.target.value)}
                      aria-label="Filter by aging bucket"
                    >
                      <option value="all">All ages</option>
                      <option value="current">Not yet due</option>
                      <option value="1-30">1-30 days</option>
                      <option value="31-60">31-60 days</option>
                      <option value="61-90">61-90 days</option>
                      <option value="90+">90+ days</option>
                      <option value="settled">Settled</option>
                    </select>
                  </th>
                  <th>
                    <select
                      className="col-filter"
                      value={taxFilter}
                      onChange={(e) => setTaxFilter(e.target.value)}
                      aria-label="Filter by tax deduction"
                    >
                      <option value="all">All</option>
                      <option value="with">With TDS / tax</option>
                      <option value="without">No deduction</option>
                    </select>
                  </th>
                  <th style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={resetFilters}
                      disabled={activeFilterCount === 0}
                      title="Clear all column filters"
                    >
                      <FilterX size={12} />
                    </button>
                  </th>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">
                      <Receipt size={32} style={{ color: "var(--ink-faint)" }} />
                      <p style={{ fontWeight: 600, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                        No matching invoices found
                      </p>
                      <p style={{ fontSize: "var(--text-xs)" }}>Adjust filters or create a new invoice</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: "0.5rem" }}
                          onClick={resetFilters}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedInvoices.map((inv) => {
                  const aging = calculateAging(inv);
                  const isSelected = selectedIds.has(inv.id);
                  const clientColor = getClientColor(inv.clientName);

                  return (
                    <tr
                      key={inv.id}
                      className={`invoice-row ${isSelected ? "row-selected" : ""}`}
                      onClick={() => onOpenPreviewInvoice(inv)}
                      title={`Click to view Invoice #${inv.invoiceNo} & PDF`}
                    >
                      {/* Checkbox */}
                      <td
                        style={{ textAlign: "center" }}
                        onClick={(e) => toggleSelectRow(inv.id, e)}
                      >
                        <label className="custom-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectRow(inv.id, e)}
                          />
                          <span className="custom-checkbox-box">
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </span>
                        </label>
                      </td>

                      {/* Invoice # */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span className="mono-num invoice-no-tag">
                            {inv.invoiceNo}
                          </span>
                        </div>
                      </td>

                      {/* Client */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            className="client-initial-badge"
                            style={{
                              backgroundColor: clientColor.bg,
                              color: clientColor.text,
                              borderColor: clientColor.border
                            }}
                          >
                            {(inv.clientName || "C").slice(0, 1).toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
                            {inv.clientName}
                          </span>
                        </div>
                      </td>

                      {/* Amount (Gross + Net if tax deducted) with currency pill */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <span className={`currency-tag currency-tag-${(inv.currency || "USD").toLowerCase()}`}>
                              {inv.currency}
                            </span>
                            <span className="mono-num" style={{ fontWeight: 700, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                              {formatCurrency(inv.amount, inv.currency)}
                            </span>
                          </div>
                          {inv.taxAmount > 0 && (
                            <span style={{ fontSize: "0.68rem", color: "var(--ink-muted)" }} className="mono-num">
                              Net: {formatCurrency(inv.netReceived, inv.currency)} (-{inv.taxRate}%)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Raised On */}
                      <td>
                        <span className="mono-num" style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}>
                          {formatDate(inv.raisedOn)}
                        </span>
                      </td>

                      {/* Status (Interactive Inline Dropdown) */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <InlineStatusDropdown
                          invoice={inv}
                          onUpdateStatus={updateInvoice}
                          onOpenMarkPaid={onOpenMarkPaid}
                          onShowToast={onShowToast}
                        />
                      </td>

                      {/* Payment Mode (Interactive Inline Dropdown) */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <InlinePaymentModeDropdown
                          invoice={inv}
                          onUpdateMode={updateInvoice}
                          onShowToast={onShowToast}
                        />
                      </td>

                      {/* Received On */}
                      <td>
                        <span className="mono-num" style={{ fontSize: "var(--text-xs)", color: inv.receivedOn ? "var(--status-received-text)" : "var(--ink-faint)" }}>
                          {inv.receivedOn ? formatDate(inv.receivedOn) : "—"}
                        </span>
                      </td>

                      {/* Due / Aging */}
                      <td>
                        {inv.status === "Received" ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                            {aging.daysToCollect !== null ? `${aging.daysToCollect}d to collect` : "—"}
                          </span>
                        ) : aging.isOverdue ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--status-overdue-text)", fontWeight: 700, display: "flex", alignItems: "center", gap: "2px" }}>
                            <AlertTriangle size={11} />
                            {aging.overdueDays}d overdue
                          </span>
                        ) : (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                            {aging.daysOutstanding}d active
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td style={{ maxWidth: "220px" }}>
                        <span
                          style={{
                            fontSize: "var(--text-xs)",
                            color: inv.remarks ? "var(--ink-primary)" : "var(--ink-faint)",
                            display: "-webkit-box",
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                          }}
                          title={inv.remarks}
                        >
                          {inv.remarks || "—"}
                        </span>
                      </td>

                      {/* Actions (Clicking actions does NOT trigger row invoice preview) */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "3px" }}>
                          {/* Quick Mark Paid */}
                          {inv.status !== "Received" && (
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ color: "var(--status-received-text)", borderColor: "var(--status-received-border)", padding: "0.2rem 0.45rem", fontSize: "0.7rem" }}
                              onClick={() => onOpenMarkPaid(inv)}
                              title="Mark as Paid"
                            >
                              <CheckCircle size={12} />
                              <span>Paid</span>
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => onOpenEditInvoice(inv)}
                            title="Edit Invoice"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Duplicate */}
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => {
                              duplicateInvoice(inv.id);
                              onShowToast(`Duplicated as new invoice`);
                            }}
                            title="Duplicate"
                          >
                            <Copy size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                            style={{ color: "var(--status-overdue-text)" }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredInvoices.length > 0 && (
        <div className="ledger-pagination">
          <div className="ledger-pagination-info">
            Showing <strong>{(safePage - 1) * pageSize + 1}</strong>–
            <strong>{Math.min(safePage * pageSize, filteredInvoices.length)}</strong> of{" "}
            <strong>{filteredInvoices.length}</strong>
            {filteredInvoices.length !== invoices.length && ` (filtered from ${invoices.length})`}
          </div>

          <div className="ledger-pagination-controls">
            <label className="ledger-pagination-size">
              <span>Rows</span>
              <select
                className="col-filter"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </label>

            <button
              type="button"
              className="btn btn-sm btn-secondary btn-icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="ledger-pagination-page">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary btn-icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState((p) => ({ ...p, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        variant={confirmState.variant}
      />
    </div>
  );
}
