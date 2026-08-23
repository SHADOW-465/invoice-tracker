import React, { useState, useEffect } from "react";
import { X, CheckCircle2, DollarSign } from "lucide-react";
import confetti from "canvas-confetti";
import { formatCurrency } from "../utils/calculations";
import { CustomDatePicker } from "./CustomDatePicker";

export function MarkPaidModal({
  isOpen,
  onClose,
  invoice,
  onConfirm
}) {
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().split("T")[0]);
  const [taxRate, setTaxRate] = useState("0");
  const [customTaxAmt, setCustomTaxAmt] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (isOpen && invoice) {
      setReceivedOn(invoice.receivedOn || new Date().toISOString().split("T")[0]);
      setTaxRate(invoice.taxRate !== undefined ? String(invoice.taxRate) : "0");
      setCustomTaxAmt(invoice.taxAmount ? String(invoice.taxAmount) : "");
      setRemarks(invoice.remarks || "");
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const totalAmt = Number(invoice.amount || 0);
  const selectedRate = parseFloat(taxRate) || 0;
  const calculatedTax = (totalAmt * selectedRate) / 100;
  const netReceived = totalAmt - calculatedTax;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Trigger confetti celebration
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) {
      // ignore
    }

    onConfirm(invoice.id, {
      receivedOn,
      taxRate: selectedRate,
      taxAmount: parseFloat(calculatedTax.toFixed(2)),
      netReceived: parseFloat(netReceived.toFixed(2)),
      remarks
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ color: "var(--status-received-text)" }}>
            <CheckCircle2 size={20} />
            <span>Mark Invoice {invoice.invoiceNo} as Received</span>
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Invoice Quick Summary */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Client</div>
                <div style={{ fontWeight: 700, color: "var(--ink-primary)" }}>{invoice.clientName}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>Invoiced Gross</div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }} className="mono-num">
                  {formatCurrency(invoice.amount, invoice.currency)}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="form-grid">
              {/* Received Date */}
              <div className="form-group">
                <label className="form-label">Date Payment Received *</label>
                <CustomDatePicker
                  value={receivedOn}
                  onChange={(val) => setReceivedOn(val)}
                  placeholder="Select payment date"
                  required
                />
              </div>

              {/* Tax / TDS Withholding Rate */}
              <div className="form-group">
                <label className="form-label">Tax / TDS Withholding (%)</label>
                <select
                  className="form-select"
                  value={taxRate}
                  onChange={(e) => {
                    setTaxRate(e.target.value);
                    const rate = parseFloat(e.target.value) || 0;
                    if (rate > 0) {
                      setRemarks(`Received payment after ${rate}% tax deduction`);
                    }
                  }}
                >
                  <option value="0">0% (No Tax Deduction)</option>
                  <option value="5">5% Withholding Tax</option>
                  <option value="10">10% Withholding Tax / TDS</option>
                  <option value="15">15% Tax Deduction (e.g. Row 4 standard)</option>
                  <option value="20">20% Withholding Tax</option>
                  <option value="30">30% Non-Resident Tax</option>
                </select>
              </div>

              {/* Calculation Summary Box */}
              <div className="form-group col-span-2">
                <div className="calc-box">
                  <div className="calc-row">
                    <span>Gross Invoiced:</span>
                    <span className="mono-num">{formatCurrency(totalAmt, invoice.currency)}</span>
                  </div>
                  {selectedRate > 0 && (
                    <div className="calc-row" style={{ color: "var(--status-overdue-text)" }}>
                      <span>Tax Withheld ({selectedRate}%):</span>
                      <span className="mono-num">-{formatCurrency(calculatedTax, invoice.currency)}</span>
                    </div>
                  )}
                  <div className="calc-row calc-highlight">
                    <span style={{ color: "var(--status-received-text)" }}>Net Amount Credited:</span>
                    <span className="mono-num" style={{ color: "var(--status-received-text)" }}>
                      {formatCurrency(netReceived, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks / Settlement Note */}
              <div className="form-group col-span-2">
                <label className="form-label">Remarks / Bank Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Received payment after 15% tax deduction"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: "var(--brand-primary)" }}
            >
              <CheckCircle2 size={16} />
              <span>Confirm & Mark as Paid</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
