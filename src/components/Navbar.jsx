import React, { useRef } from "react";
import {
  Plus,
  Download,
  Upload,
  Moon,
  Sun,
  Users,
  RotateCcw,
  Settings,
  ReceiptText
} from "lucide-react";
import { CURRENCIES } from "../types/finance";
import { exportToExcel, parseExcelFile } from "../utils/excelHandler";
import { CustomSelect } from "./CustomSelect";

export function Navbar({
  store,
  onOpenNewInvoice,
  onOpenClients,
  onOpenSettings,
  onShowToast
}) {
  const fileInputRef = useRef(null);

  const handleExport = () => {
    try {
      exportToExcel(store.invoices, `Invoice_Tracker_${new Date().toISOString().split("T")[0]}.xlsx`);
      onShowToast("Exported invoices to Excel!");
    } catch (e) {
      console.error(e);
      onShowToast("Failed to export Excel file", "error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        onShowToast("No invoice rows found in uploaded file", "error");
        return;
      }
      store.importInvoices(parsed, "merge");
      onShowToast(`Imported ${parsed.length} invoices successfully!`);
    } catch (err) {
      console.error("Import error", err);
      onShowToast("Failed to parse Excel file. Check format.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand: Invoice Tracker */}
        <div className="brand-section">
          <div className="brand-logo-badge" title="Invoice Tracker">
            <ReceiptText size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="brand-title">Invoice Tracker</h1>
            <p className="brand-subtitle">{store.settings.companyName || "Financial Receivables Ledger"}</p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="nav-actions">
          {/* Base Currency Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }} title="Convert dashboard totals to Base Currency">
            <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)", fontWeight: 600 }}>
              Base:
            </span>
            <CustomSelect
              value={store.baseCurrency}
              onChange={(val) => store.setBaseCurrency(val)}
              options={CURRENCIES.map((c) => ({
                value: c.code,
                label: `${c.code} (${c.symbol})`,
                badge: c.code,
                sublabel: c.name
              }))}
              size="sm"
              align="left"
            />
          </div>

          {/* Import Excel */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            style={{ display: "none" }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Import invoices from Excel (.xlsx) or CSV"
          >
            <Upload size={13} />
            <span>Import</span>
          </button>

          {/* Export to Excel */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
            title="Export to Excel matching original sheet format"
          >
            <Download size={13} />
            <span>Export</span>
          </button>

          {/* Clients Directory */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenClients}
            title="Client Directory & Balances"
          >
            <Users size={13} />
            <span>Clients</span>
          </button>

          {/* Settings */}
          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={onOpenSettings}
            title="Business Preferences"
          >
            <Settings size={14} />
          </button>

          {/* Reset / Sample Data */}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => {
              if (window.confirm("Reset data to original Invoice Tracker.xlsx records?")) {
                store.resetToSampleData();
                onShowToast("Reset to original sample records");
              }
            }}
            title="Reset to Original Excel Records"
          >
            <RotateCcw size={14} />
          </button>

          {/* Theme Switcher */}
          <button
            className="btn btn-secondary btn-sm btn-icon"
            onClick={store.toggleTheme}
            title={`Switch to ${store.theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {store.theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* New Invoice CTA */}
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenNewInvoice}
            style={{ marginLeft: "0.25rem" }}
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Invoice</span>
          </button>
        </div>
      </div>
    </header>
  );
}
