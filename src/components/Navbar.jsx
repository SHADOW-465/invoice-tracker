import React, { useRef, useState, useMemo } from "react";
import {
  Plus,
  Download,
  Upload,
  Moon,
  Sun,
  Users,
  Settings,
  ReceiptText,
  FolderKanban,
  FileSpreadsheet,
  History
} from "lucide-react";
import { CURRENCIES } from "../types/finance";
import { exportToExcel, parseExcelFile } from "../utils/excelHandler";
import { CustomSelect } from "./CustomSelect";
import { ImportModal } from "./ImportModal";

export function Navbar({
  store,
  onOpenNewInvoice,
  onOpenClients,
  onOpenSettings,
  onOpenHistory,
  appView = "ledger",
  onGoToLedger,
  onShowToast
}) {
  const fileInputRef = useRef(null);
  const [importModalData, setImportModalData] = useState({
    isOpen: false,
    file: null,
    sheetName: "",
    parsedInvoices: [],
    parsedClients: []
  });

  const activeName = store.activeWorkspace?.name || "Master Ledger";

  const handleExport = () => {
    try {
      const ledgerName = activeName.replace(/[^a-zA-Z0-9_-]/g, "_");
      exportToExcel(store.invoices, `${ledgerName}_${new Date().toISOString().split("T")[0]}.xlsx`);
      onShowToast(`Exported "${activeName}" to Excel!`);
    } catch (e) {
      console.error(e);
      onShowToast("Failed to export Excel file", "error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseExcelFile(file);
      const invoices = result.parsedInvoices || [];
      if (invoices.length === 0) {
        onShowToast("No valid invoice rows found in uploaded file", "error");
        return;
      }
      setImportModalData({
        isOpen: true,
        file,
        sheetName: result.sheetName || "",
        parsedInvoices: invoices,
        parsedClients: result.parsedClients || []
      });
    } catch (err) {
      console.error("Import error", err);
      onShowToast("Failed to parse Excel file. Check format.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = (invoices, mode, workspaceName) => {
    store.importInvoices(invoices, mode, workspaceName, importModalData.parsedClients, {
      fileName: importModalData.file?.name || "",
      mode
    });
    if (mode === "new_workspace") {
      onShowToast(`Loaded "${workspaceName}" with ${invoices.length} invoices!`, "success");
    } else {
      onShowToast(`Imported ${invoices.length} invoices into "${activeName}"!`, "success");
    }
  };

  // Workspace options for CustomSelect
  const workspaceOptions = useMemo(() => {
    const list = (store.workspaces || []).map((w) => ({
      value: w.id,
      label: w.name,
      badge: `${w.invoices?.length || 0}`,
      sublabel: `Created ${new Date(w.createdAt || Date.now()).toLocaleDateString()}`
    }));

    list.push({
      value: "__NEW_WORKSPACE__",
      label: "+ Create New Blank Ledger",
      sublabel: "Empty workspace"
    });

    return list;
  }, [store.workspaces]);

  const handleWorkspaceChange = (val) => {
    if (val === "__NEW_WORKSPACE__") {
      const num = (store.workspaces?.length || 0) + 1;
      const newName = `Ledger Workspace ${num}`;
      store.createWorkspace(newName, []);
      onShowToast(`Created new blank ledger "${newName}"`, "info");
    } else {
      store.switchWorkspace(val);
      if (typeof onGoToLedger === "function") onGoToLedger();
      const target = store.workspaces?.find((w) => w.id === val);
      onShowToast(`Switched to ledger "${target?.name || 'Ledger'}"`, "info");
    }
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          {/* Brand: Invoice Tracker & Workspace Switcher */}
          <div className="brand-section">
            <div className="brand-logo-badge" title="Invoice Tracker">
              <ReceiptText size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h1
                  className="brand-title"
                  onClick={onGoToLedger}
                  style={{ cursor: onGoToLedger ? "pointer" : "default" }}
                  title="Back to ledger"
                >
                  Invoice Tracker
                </h1>
                {/* Multi-Ledger / Workspace Selector */}
                <div style={{ display: "inline-flex", alignItems: "center" }} title="Switch between Excel ledgers">
                  <CustomSelect
                    value={store.activeWorkspaceId}
                    onChange={handleWorkspaceChange}
                    options={workspaceOptions}
                    size="sm"
                    align="left"
                  />
                </div>
              </div>
              <p className="brand-subtitle" title={activeName}>
                Ledger: <strong style={{ color: "var(--ink-primary)" }}>{activeName}</strong> ({store.invoices?.length || 0} invoices)
              </p>
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
              accept=".xlsx, .xls, .xlsm, .csv"
              style={{ display: "none" }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title="Import invoices from any Excel (.xlsx, .xls) or CSV file"
            >
              <Upload size={13} />
              <span>Import</span>
            </button>

            {/* Export to Excel */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExport}
              title="Export active ledger to Excel"
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

            <button
              className={`btn btn-secondary btn-sm${appView === "history" ? " history-nav-active" : ""}`}
              onClick={onOpenHistory}
              title="Invoice and import history"
            >
              <History size={13} />
              <span>History</span>
            </button>

            {/* Settings */}
            <button
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onOpenSettings}
              title="Business Preferences & Storage Reset"
            >
              <Settings size={14} />
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

      {/* Import Modal */}
      <ImportModal
        isOpen={importModalData.isOpen}
        onClose={() => setImportModalData({ isOpen: false, file: null, sheetName: "", parsedInvoices: [], parsedClients: [] })}
        file={importModalData.file}
        sheetName={importModalData.sheetName}
        parsedInvoices={importModalData.parsedInvoices}
        activeWorkspaceName={activeName}
        onConfirmImport={handleConfirmImport}
      />
    </>
  );
}
