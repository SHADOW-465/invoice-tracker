import React, { useState, useEffect } from "react";
import { X, Settings, Building2, Save, Trash2, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";
import { CURRENCIES, PAYMENT_TERMS } from "../types/finance";
import { ConfirmDialog } from "./ConfirmDialog";
import { DatabasePanel } from "./DatabasePanel";

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
    onConfirm: () => { }
  });

  useEffect(() => {
    if (isOpen) {
      setForm(settings);
    }
  }, [isOpen, settings]);

  // Any currency in the ledger needs a rate field, even one absent from the built-in
  // table - otherwise it converts at 1:1 with no way to correct it.
  const rateCodes = Array.from(new Set([
    ...CURRENCIES.map((c) => c.code),
    ...(store?.availableCurrencies || [])
  ])).sort();

  // Stored internally as "value of one unit in USD" (INR -> 0.012), but nobody
  // quotes rates that way, so the field takes the familiar "83.33 INR per USD".
  const rateToPerUsd = (rateInUsd) => {
    const n = Number(rateInUsd);
    if (!n || !isFinite(n) || n <= 0) return "";
    return Number((1 / n).toFixed(4));
  };

  const handleRateChange = (code, perUsdRaw) => {
    const perUsd = Number(perUsdRaw);
    setForm((p) => ({
      ...p,
      exchangeRates: {
        ...(p.exchangeRates || {}),
        [code]: perUsd > 0 && isFinite(perUsd) ? 1 / perUsd : 0
      }
    }));
  };

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

                {/* Exchange Rates - every base-currency total on the dashboard is
                    computed from these, so they must be the user's to correct. */}
                <div className="form-group col-span-2">
                  <label className="form-label">Exchange Rates</label>
                  <p className="form-hint">
                    How many units of each currency equal <strong>1 USD</strong>. Used for every
                    converted total. Rates apply to the whole ledger, so changing one restates
                    historical figures.
                  </p>
                  <div className="rate-grid">
                    {rateCodes.map((code) => {
                      const perUsd = rateToPerUsd(form.exchangeRates?.[code]);
                      const missing = !form.exchangeRates?.[code];
                      return (
                        <div key={code} className={`rate-cell ${missing ? "rate-cell-missing" : ""}`}>
                          <span className="rate-cell-code">1 USD =</span>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            className="form-input mono-num"
                            value={perUsd}
                            disabled={code === "USD"}
                            placeholder="not set"
                            onChange={(e) => handleRateChange(code, e.target.value)}
                            aria-label={`Units of ${code} per US dollar`}
                          />
                          <span className="rate-cell-unit">{code}</span>
                        </div>
                      );
                    })}
                  </div>
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

                {/* Where the ledger lives, and how to get it back. */}
                <div className="form-group col-span-2" style={{ marginTop: "0.5rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-subtle)" }}>
                  <label className="form-label">Storage &amp; Backups</label>
                  <DatabasePanel store={store} onShowToast={onShowToast} />
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
