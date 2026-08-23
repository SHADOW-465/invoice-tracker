import React, { useState, useMemo } from "react";
import {
  Search,
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
import { MONTH_NAMES, calculateAging, formatDate, formatCurrency, getClientColor } from "../utils/calculations";
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
  const statusCounts = useMemo(() => {
    const counts = { all: invoices.length, Received: 0, Pending: 0, Overdue: 0, Draft: 0 };
    invoices.forEach((inv) => {
      const aging = calculateAging(inv);
      if (inv.status === "Received") counts.Received += 1;
      else if (aging.isOverdue) counts.Overdue += 1;
      else if (inv.status === "Pending") counts.Pending += 1;
      else if (inv.status === "Draft") counts.Draft += 1;
    });
    return counts;
  }, [invoices]);

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

  const toggleSelectAll = (e) => {
    e.stopPropagation();
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((i) => i.id)));
    }
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

  // Currency options for CustomSelect
  const currencyOptions = useMemo(() => [
    { value: "all", label: "All Currencies" },
    ...CURRENCIES.map((c) => ({
      value: c.code,
      label: `${c.code} (${c.symbol})`,
      badge: c.code,
      sublabel: c.name
    }))
  ], []);

  // Month options for CustomSelect
  const monthOptions = useMemo(() => [
    { value: "all", label: "All Months" },
    ...MONTH_NAMES.map((m) => ({
      value: m,
      label: m
    }))
  ], []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                  <label className="custom-checkbox-label" title="Select all filtered invoices">
                    <input
                      type="checkbox"
                      checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                      onChange={toggleSelectAll}
                    />
                    <span className="custom-checkbox-box">
                      {filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length && (
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
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const aging = calculateAging(inv);
                  const statusClass =
                    inv.status === "Received"
                      ? "status-received"
                      : aging.isOverdue
                      ? "status-overdue"
                      : inv.status === "Pending"
                      ? "status-pending"
                      : "status-draft";

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
