import React, { useState, useEffect } from "react";
import { X, Settings, Building2, Save, Trash2, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";
import { CURRENCIES, PAYMENT_TERMS } from "../types/finance";
import { ConfirmDialog } from "./ConfirmDialog";

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onShowToast,
  store
}) {
  const [form, setForm] = useState(settings);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    variant: "danger",
    onConfirm: () => {}
  });

  useEffect(() => {
    if (isOpen) {
      setForm(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(form);
    onShowToast("Settings updated successfully!");
    onClose();
  };

  const handleClearLedger = () => {
    setConfirmDialog({
      isOpen: true,
      title: `Clear all invoices from "${store.activeWorkspace?.name || 'current ledger'}"?`,
      message: "This will remove all invoice records from this ledger, leaving it completely blank (0 records) ready for your own new invoices or Excel import. This action cannot be undone.",
      confirmText: "Clear All Invoices",
      variant: "danger",
      onConfirm: () => {
        store.clearCurrentLedger();
        onShowToast(`Cleared ledger "${store.activeWorkspace?.name || 'Ledger'}"`, "delete");
      }
    });
  };

  const handleResetSampleData = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Restore demo sample data?",
      message: "This will load the 5 original demo sample invoices and clients. Any existing records in this ledger will be replaced.",
      confirmText: "Restore Demo Data",
      variant: "warning",
      onConfirm: () => {
        store.resetToSampleData();
        onShowToast("Restored demo sample records", "info");
      }
    });
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
          <div className="modal-header">
            <h2 className="modal-title">
              <Settings size={20} color="var(--brand-primary)" />
              <span>Business & Ledger Settings</span>
            </h2>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-grid">
                {/* Company Name */}
                <div className="form-group">
                  <label className="form-label">Business / Entity Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.companyName || ""}
                    onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                    required
                  />
                </div>

                {/* Company Email */}
                <div className="form-group">
                  <label className="form-label">Accounts / Billing Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.companyEmail || ""}
                    onChange={(e) => setForm((p) => ({ ...p, companyEmail: e.target.value }))}
                    required
                  />
                </div>

                {/* Invoice Prefix */}
                <div className="form-group">
                  <label className="form-label">Invoice Number Prefix</label>
                  <input
                    type="text"
                    className="form-input mono-num"
                    placeholder="e.g. SnS"
                    value={form.invoicePrefix || ""}
                    onChange={(e) => setForm((p) => ({ ...p, invoicePrefix: e.target.value }))}
                  />
                </div>

                {/* Default Currency */}
                <div className="form-group">
                  <label className="form-label">Default Transaction Currency</label>
                  <select
                    className="form-select"
                    value={form.defaultCurrency || "USD"}
                    onChange={(e) => setForm((p) => ({ ...p, defaultCurrency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default Payment Terms */}
                <div className="form-group col-span-2">
                  <label className="form-label">Default Payment Terms</label>
                  <select
                    className="form-select"
                    value={form.defaultPaymentTerms || "Net 30"}
                    onChange={(e) => setForm((p) => ({ ...p, defaultPaymentTerms: e.target.value }))}
                  >
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t.label} value={t.label}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div className="form-group col-span-2">
                  <label className="form-label">Business Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.companyAddress || ""}
                    onChange={(e) => setForm((p) => ({ ...p, companyAddress: e.target.value }))}
                  />
                </div>

                {/* Bank & Remittance Instructions */}
                <div className="form-group col-span-2">
                  <label className="form-label">Bank & Wire Payment Instructions</label>
                  <textarea
                    className="form-textarea mono-num"
                    placeholder="Bank name, IBAN/Routing, Account Number, SWIFT code..."
                    value={form.bankDetails || ""}
                    onChange={(e) => setForm((p) => ({ ...p, bankDetails: e.target.value }))}
                  />
                </div>

                {/* Data & Storage Management (Moved safely from navbar) */}
                <div className="form-group col-span-2" style={{ marginTop: "0.5rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                    <AlertTriangle size={15} color="var(--btn-danger-bg)" />
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-primary)", letterSpacing: "0.04em" }}>
                      Ledger Data & Storage Management
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginBottom: "0.75rem" }}>
                    Active Ledger: <strong>{store.activeWorkspace?.name || "Master Ledger"}</strong> ({store.invoices.length} invoices).
                  </p>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleClearLedger}
                      style={{ color: "var(--btn-danger-bg)", borderColor: "var(--border-strong)" }}
                    >
                      <Trash2 size={13} />
                      <span>Clear Active Ledger (Blank Slate)</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleResetSampleData}
                    >
                      <RotateCcw size={13} />
                      <span>Restore Demo Sample Records</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Save size={15} />
                <span>Save Preferences</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
      />
    </>
  );
}
