import React, { useState, useEffect } from "react";
import { X, FileSpreadsheet, PlusCircle, Layers, RefreshCw, CheckCircle2, FolderCheck } from "lucide-react";
import { formatCurrency } from "../utils/calculations";

export function ImportModal({
  isOpen,
  onClose,
  file,
  parsedInvoices,
  sheetName,
  activeWorkspaceName,
  onConfirmImport
}) {
  const [importMode, setImportMode] = useState("new_workspace");
  const [workspaceName, setWorkspaceName] = useState("");

  // Sync default ledger name whenever a new file is loaded
  useEffect(() => {
    if (file?.name) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setWorkspaceName(cleanName);
    }
  }, [file]);

  if (!isOpen || !parsedInvoices || parsedInvoices.length === 0) return null;

  const handleImport = (e) => {
    e.preventDefault();
    const finalName = workspaceName.trim() || file?.name?.replace(/\.[^/.]+$/, "") || "Imported Ledger";
    onConfirmImport(parsedInvoices, importMode, finalName);
    onClose();
  };

  const displayName = workspaceName || file?.name?.replace(/\.[^/.]+$/, "") || "New Ledger";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "580px" }}>
        <div className="modal-header">
          <h2 className="modal-title">
            <FileSpreadsheet size={20} color="var(--brand-primary)" />
            <span>Import Excel Spreadsheet</span>
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleImport}>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* File & Sheet Info Callout */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.85rem 1rem",
              background: "var(--bg-surface-elevated)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)"
            }}>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Detected File & Sheet</div>
                <div style={{ fontWeight: 700, color: "var(--ink-primary)", fontSize: "var(--text-sm)", wordBreak: "break-all" }}>
                  {file?.name || "Excel Spreadsheet"}
                </div>
                {sheetName && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--brand-primary)", marginTop: "2px", fontWeight: 600 }}>
                    Sheet: "{sheetName}"
                  </div>
                )}
              </div>
              <span className="kpi-badge kpi-badge-success" style={{ whiteSpace: "nowrap" }}>
                <span>{parsedInvoices.length} Invoices Found</span>
              </span>
            </div>

            {/* Import Mode Radio Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <label className="form-label" style={{ marginBottom: "0.25rem" }}>
                Select Ledger Destination:
              </label>

              {/* Option 1: New Separate Ledger Workspace (Default & Recommended) */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: `1.5px solid ${importMode === "new_workspace" ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                  background: importMode === "new_workspace" ? "var(--brand-surface)" : "var(--bg-surface)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)"
                }}
              >
                <input
                  type="radio"
                  name="importMode"
                  value="new_workspace"
                  checked={importMode === "new_workspace"}
                  onChange={() => setImportMode("new_workspace")}
                  style={{ marginTop: "3px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                    <PlusCircle size={14} color="var(--brand-primary)" />
                    <span>Create as a New Ledger Workspace</span>
                    <span style={{ fontSize: "0.65rem", padding: "1px 5px", borderRadius: "3px", background: "var(--brand-primary)", color: "#fff", fontWeight: 800 }}>
                      RECOMMENDED
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginTop: "2px" }}>
                    Keeps this workbook isolated in its own tabbed ledger without modifying other files.
                  </p>

                  {importMode === "new_workspace" && (
                    <div style={{ marginTop: "0.65rem" }}>
                      <label className="form-label" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-primary)" }}>
                        Ledger Workspace Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="e.g. Revenue & Pipeline_Simon and Sons_2530 Onwards_3"
                        required
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: Merge into current ledger */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: `1.5px solid ${importMode === "merge" ? "var(--brand-primary)" : "var(--border-subtle)"}`,
                  background: importMode === "merge" ? "var(--brand-surface)" : "var(--bg-surface)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)"
                }}
              >
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                    <Layers size={14} />
                    <span>Append / Merge into "{activeWorkspaceName}"</span>
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginTop: "2px" }}>
                    Adds these rows into the active ledger "{activeWorkspaceName}".
                  </p>
                </div>
              </label>

              {/* Option 3: Replace current ledger */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: `1.5px solid ${importMode === "replace" ? "var(--btn-danger-bg)" : "var(--border-subtle)"}`,
                  background: importMode === "replace" ? "var(--status-overdue-bg)" : "var(--bg-surface)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)"
                }}
              >
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700, color: "var(--ink-primary)", fontSize: "var(--text-sm)" }}>
                    <RefreshCw size={14} color="var(--status-overdue-text)" />
                    <span>Replace "{activeWorkspaceName}" completely</span>
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)", marginTop: "2px" }}>
                    Replaces existing rows in "{activeWorkspaceName}" with this imported file.
                  </p>
                </div>
              </label>
            </div>

            {/* Preview of first rows */}
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                Preview of Rows to Import ({Math.min(3, parsedInvoices.length)} of {parsedInvoices.length})
              </div>
              <div style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xs)", padding: "0.5rem", fontSize: "0.72rem" }}>
                {parsedInvoices.slice(0, 3).map((inv, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: idx < 2 ? "1px solid var(--border-subtle)" : "none" }}>
                    <span className="mono-num" style={{ fontWeight: 600, color: "var(--brand-primary)" }}>{inv.invoiceNo}</span>
                    <span style={{ color: "var(--ink-primary)" }}>{inv.clientName}</span>
                    <span className="mono-num" style={{ fontWeight: 700 }}>{formatCurrency(inv.amount, inv.currency)}</span>
                    <span style={{ color: inv.status === "Received" ? "var(--status-received-text)" : "var(--status-pending-text)" }}>{inv.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <FolderCheck size={15} />
              <span>Import as "{importMode === 'new_workspace' ? displayName : activeWorkspaceName}"</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
