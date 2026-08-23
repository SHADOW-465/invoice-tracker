import React, { useState, useEffect } from "react";
import { X, Sparkles, AlertCircle } from "lucide-react";
import { CURRENCIES, PAYMENT_MODES, PAYMENT_TERMS, STATUS_TYPES } from "../types/finance";
import { getMonthName, calculateDueDate } from "../utils/calculations";

export function InvoiceModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  getNextInvoiceNumber,
  clients
}) {
  const isEditing = Boolean(initialData && initialData.id);

  const [formData, setFormData] = useState({
    invoiceNo: "",
    clientName: "",
    amount: "",
    currency: "USD",
    paymentMode: "Online",
    raisedOn: new Date().toISOString().split("T")[0],
    invoicedMonth: "January",
    status: "Pending",
    paymentTerms: "Net 30",
    dueDate: "",
    taxRate: "0",
    remarks: ""
  });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setErrorMessage("");
      if (initialData) {
        setFormData({
          invoiceNo: initialData.invoiceNo || "",
          clientName: initialData.clientName || "",
          amount: initialData.amount !== undefined ? String(initialData.amount) : "",
          currency: initialData.currency || "USD",
          paymentMode: initialData.paymentMode || "Online",
          raisedOn: initialData.raisedOn || new Date().toISOString().split("T")[0],
          invoicedMonth: initialData.invoicedMonth || getMonthName(initialData.raisedOn || new Date()),
          status: initialData.status || "Pending",
          paymentTerms: initialData.paymentTerms || "Net 30",
          dueDate: initialData.dueDate || "",
          taxRate: initialData.taxRate !== undefined ? String(initialData.taxRate) : "0",
          remarks: initialData.remarks || ""
        });
      } else {
        const today = new Date().toISOString().split("T")[0];
        const nextNo = getNextInvoiceNumber();
        const due = calculateDueDate(today, 30);
        setFormData({
          invoiceNo: nextNo,
          clientName: "",
          amount: "",
          currency: "USD",
          paymentMode: "Online",
          raisedOn: today,
          invoicedMonth: getMonthName(today),
          status: "Pending",
          paymentTerms: "Net 30",
          dueDate: due,
          taxRate: "0",
          remarks: ""
        });
      }
    }
  }, [isOpen, initialData, getNextInvoiceNumber]);

  if (!isOpen) return null;

  const handleRaisedOnChange = (e) => {
    setErrorMessage("");
    const val = e.target.value;
    const m = getMonthName(val);
    let due = formData.dueDate;
    if (formData.paymentTerms === "Net 30") due = calculateDueDate(val, 30);
    else if (formData.paymentTerms === "Net 15") due = calculateDueDate(val, 15);
    else if (formData.paymentTerms === "Net 45") due = calculateDueDate(val, 45);
    else if (formData.paymentTerms === "Net 60") due = calculateDueDate(val, 60);
    else if (formData.paymentTerms === "Due Immediately (Net 0)") due = calculateDueDate(val, 0);

    setFormData(prev => ({
      ...prev,
      raisedOn: val,
      invoicedMonth: m,
      dueDate: due
    }));
  };

  const handleTermsChange = (e) => {
    setErrorMessage("");
    const term = e.target.value;
    let due = formData.dueDate;
    if (term.includes("15")) due = calculateDueDate(formData.raisedOn, 15);
    else if (term.includes("30")) due = calculateDueDate(formData.raisedOn, 30);
    else if (term.includes("45")) due = calculateDueDate(formData.raisedOn, 45);
    else if (term.includes("60")) due = calculateDueDate(formData.raisedOn, 60);
    else if (term.includes("0") || term.includes("Immediately")) due = calculateDueDate(formData.raisedOn, 0);

    setFormData(prev => ({
      ...prev,
      paymentTerms: term,
      dueDate: due
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.invoiceNo.trim()) {
      setErrorMessage("Please enter an Invoice Number (e.g. SnS02535)");
      return;
    }
    if (!formData.clientName.trim()) {
      setErrorMessage("Please enter or select a Client Name");
      return;
    }
    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      setErrorMessage("Please enter a valid invoice amount greater than 0");
      return;
    }

    const amt = parseFloat(formData.amount);
    const taxR = parseFloat(formData.taxRate || 0);
    const taxAmt = (amt * taxR) / 100;
    const netRec = amt - taxAmt;

    onSave({
      ...formData,
      amount: amt,
      taxRate: taxR,
      taxAmount: parseFloat(taxAmt.toFixed(2)),
      netReceived: formData.status === "Received" ? parseFloat(netRec.toFixed(2)) : 0
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? `Edit Invoice ${formData.invoiceNo}` : "Create New Invoice"}
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMessage && (
              <div className="form-error-banner">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}
            <div className="form-grid">
              {/* Invoice # */}
              <div className="form-group">
                <label className="form-label">
                  <span>Invoice # *</span>
                  {!isEditing && (
                    <button
                      type="button"
                      style={{ fontSize: "0.7rem", color: "var(--brand-primary)", display: "flex", alignItems: "center", gap: "2px" }}
                      onClick={() => setFormData(p => ({ ...p, invoiceNo: getNextInvoiceNumber() }))}
                    >
                      <Sparkles size={11} /> Auto Next
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  className="form-input mono-num"
                  placeholder="e.g. SnS02535"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData(p => ({ ...p, invoiceNo: e.target.value }))}
                  required
                />
              </div>

              {/* Client Name */}
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-input"
                  list="clients-datalist"
                  placeholder="Client name / company"
                  value={formData.clientName}
                  onChange={(e) => setFormData(p => ({ ...p, clientName: e.target.value }))}
                  required
                />
                <datalist id="clients-datalist">
                  {clients.map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Actual Invoiced Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input mono-num"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>

              {/* Currency / UOM */}
              <div className="form-group">
                <label className="form-label">Currency (UOM) *</label>
                <select
                  className="form-select"
                  value={formData.currency}
                  onChange={(e) => setFormData(p => ({ ...p, currency: e.target.value }))}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Raised on Date */}
              <div className="form-group">
                <label className="form-label">Raised on (Invoice Date) *</label>
                <input
                  type="date"
                  className="form-input mono-num"
                  value={formData.raisedOn}
                  onChange={handleRaisedOnChange}
                  required
                />
              </div>

              {/* Invoiced Month */}
              <div className="form-group">
                <label className="form-label">Invoiced Month</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.invoicedMonth}
                  onChange={(e) => setFormData(p => ({ ...p, invoicedMonth: e.target.value }))}
                />
              </div>

              {/* Payment Terms */}
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select
                  className="form-select"
                  value={formData.paymentTerms}
                  onChange={handleTermsChange}
                >
                  {PAYMENT_TERMS.map(t => (
                    <option key={t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-input mono-num"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                />
              </div>

              {/* Mode of Payment */}
              <div className="form-group">
                <label className="form-label">Mode of Payment</label>
                <select
                  className="form-select"
                  value={formData.paymentMode}
                  onChange={(e) => setFormData(p => ({ ...p, paymentMode: e.target.value }))}
                >
                  {PAYMENT_MODES.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Collection Status */}
              <div className="form-group">
                <label className="form-label">Collection Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                >
                  {STATUS_TYPES.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks */}
              <div className="form-group col-span-2">
                <label className="form-label">Remarks / Deductions / Notes</label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. Received payment after 15% tax deduction or bank reference"
                  value={formData.remarks}
                  onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? "Save Changes" : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
