import React, { useState, useEffect } from "react";
import { X, Settings, Building2, Save } from "lucide-react";
import { CURRENCIES, PAYMENT_TERMS } from "../types/finance";

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onShowToast
}) {
  const [form, setForm] = useState(settings);

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Settings size={20} color="var(--brand-primary)" />
            <span>Business & Invoice Preferences</span>
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
  );
}
