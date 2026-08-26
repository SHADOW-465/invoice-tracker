import React, { useEffect, useMemo, useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { formatCurrency } from "../utils/calculations";
import { CustomDatePicker } from "./CustomDatePicker";

/**
 * Records a payment against an invoice - full, taxed, or partial.
 *
 * One modal covers all three because they are the same operation at different
 * amounts: how much actually landed. The amount field is the authoritative value;
 * tax is a convenience that recomputes its default. Whether the invoice ends up
 * "Received" or "Partially Paid" is decided here, from whether a balance remains,
 * not chosen by the user from a list.
 */
export function MarkPaidModal({ isOpen, onClose, invoice, onConfirm }) {
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().split("T")[0]);
  const [taxRate, setTaxRate] = useState("0");
  const [amountReceived, setAmountReceived] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [remarksTouched, setRemarksTouched] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      const amt = Number(invoice.amount || 0);
      const rate = invoice.taxRate !== undefined ? Number(invoice.taxRate) : 0;
      const defaultNet = Math.max(0, amt - (amt * rate) / 100);

      setReceivedOn(invoice.receivedOn || new Date().toISOString().split("T")[0]);
      setTaxRate(String(rate));
      // A record that already has a received amount (editing an existing partial
      // or settled invoice) keeps it; a fresh one defaults to the full net amount.
      const hasExistingNet =
        invoice.netReceived !== undefined && invoice.netReceived !== null && Number(invoice.netReceived) !== 0;
      setAmountReceived(hasExistingNet ? String(invoice.netReceived) : defaultNet.toFixed(2));
      // Treat an existing amount as user-authored so a later tax-rate change
      // does not overwrite the recorded partial.
      setAmountTouched(hasExistingNet);
      setRemarks(invoice.remarks || "");
      setRemarksTouched(false);
    }
  }, [isOpen, invoice]);

  const totalAmt = Number(invoice?.amount || 0);
  const selectedRate = parseFloat(taxRate) || 0;
  const calculatedTax = (totalAmt * selectedRate) / 100;
  const owedAfterTax = Math.max(0, totalAmt - calculatedTax);

  const enteredAmount = parseFloat(amountReceived);
  const validAmount = !isNaN(enteredAmount) && enteredAmount >= 0;
  const balance = validAmount ? Math.round((owedAfterTax - enteredAmount) * 100) / 100 : owedAfterTax;
  const isFullySettled = validAmount && balance <= 0.01;
  const isOverpaid = validAmount && balance < -0.01;

  // When the tax rate changes and the user has not typed their own amount, keep
  // the suggested amount matching "fully settled after this withholding". Driven
  // from the select's onChange so it cannot race with the open-effect that
  // restores an existing partial.

  const autoRemarks = useMemo(() => {
    if (!validAmount) return "";
    if (selectedRate > 0 && isFullySettled) {
      return `Received payment after ${selectedRate}% tax deduction`;
    }
    if (!isFullySettled && !isOverpaid) {
      return `Partially paid: ${formatCurrency(enteredAmount, invoice?.currency)} received, ${formatCurrency(balance, invoice?.currency)} balance remaining`;
    }
    return "";
  }, [validAmount, selectedRate, isFullySettled, isOverpaid, enteredAmount, balance, invoice?.currency]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validAmount) return;

    const finalStatus = isFullySettled ? "Received" : "Partially Paid";
    // Never overwrite text the user actually typed; only fill in when they left
    // the field untouched, and only up to the point they start customising it.
    const finalRemarks = remarksTouched ? remarks : autoRemarks || remarks;

    if (finalStatus === "Received") {
      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      } catch {
        /* confetti is decorative; never let it block a save */
      }
    }

    onConfirm(invoice.id, {
      receivedOn,
      taxRate: selectedRate,
      taxAmount: parseFloat(calculatedTax.toFixed(2)),
      netReceived: parseFloat(enteredAmount.toFixed(2)),
      status: finalStatus,
      remarks: finalRemarks
    });

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2
            className="modal-title"
            style={{ color: isFullySettled ? "var(--status-received-text)" : "var(--status-partial-text)" }}
          >
            <CheckCircle2 size={20} />
            <span>
              {isFullySettled
                ? `Mark Invoice ${invoice.invoiceNo} as Received`
                : `Record Payment for ${invoice.invoiceNo}`}
            </span>
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date Payment Received *</label>
                <CustomDatePicker
                  value={receivedOn}
                  onChange={(val) => setReceivedOn(val)}
                  placeholder="Select payment date"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tax / TDS Withholding (%)</label>
                <select
                  className="form-select"
                  value={taxRate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTaxRate(next);
                    if (!amountTouched) {
                      const rate = parseFloat(next) || 0;
                      const tax = (totalAmt * rate) / 100;
                      setAmountReceived(Math.max(0, totalAmt - tax).toFixed(2));
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
                <p className="form-hint">
                  Money withheld by the client on the government's behalf - never owed back, so it
                  is not part of the balance below.
                </p>
              </div>

              {/* The one authoritative number: how much actually landed. Editable
                  so a genuine partial payment - unrelated to any tax withholding -
                  can be recorded exactly as received. */}
              <div className="form-group col-span-2">
                <label className="form-label">Amount Actually Received *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input mono-num"
                  value={amountReceived}
                  onChange={(e) => {
                    setAmountReceived(e.target.value);
                    setAmountTouched(true);
                  }}
                  required
                />
                {!validAmount && (
                  <div className="field-error">
                    <AlertCircle size={12} /> Enter the amount that was actually credited.
                  </div>
                )}
              </div>

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
                  <div className="calc-row" style={{ color: "var(--ink-secondary)" }}>
                    <span>Owed After Tax:</span>
                    <span className="mono-num">{formatCurrency(owedAfterTax, invoice.currency)}</span>
                  </div>
                  <div className="calc-row" style={{ color: "var(--status-received-text)" }}>
                    <span>Amount Received:</span>
                    <span className="mono-num">{formatCurrency(validAmount ? enteredAmount : 0, invoice.currency)}</span>
                  </div>
                  <div
                    className="calc-row calc-highlight"
                    style={{
                      color: isFullySettled
                        ? "var(--status-received-text)"
                        : isOverpaid
                        ? "var(--status-overdue-text)"
                        : "var(--status-partial-text)"
                    }}
                  >
                    <span>
                      {isFullySettled ? "Fully Settled" : isOverpaid ? "Overpaid By" : "Balance Remaining"}
                    </span>
                    <span className="mono-num">
                      {isFullySettled
                        ? formatCurrency(0, invoice.currency)
                        : formatCurrency(Math.abs(balance), invoice.currency)}
                    </span>
                  </div>
                </div>
                {!isFullySettled && !isOverpaid && validAmount && (
                  <p className="form-hint" style={{ color: "var(--status-partial-text)" }}>
                    This invoice will be marked <strong>Partially Paid</strong>. The remaining balance
                    stays on the books and continues ageing toward overdue like any other receivable.
                  </p>
                )}
                {isOverpaid && (
                  <p className="form-hint" style={{ color: "var(--status-overdue-text)" }}>
                    The amount entered is more than what was owed after tax. The invoice will still be
                    marked Received - double-check the figure before confirming.
                  </p>
                )}
              </div>

              <div className="form-group col-span-2">
                <label className="form-label">Remarks / Bank Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Received payment after 15% tax deduction"
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    setRemarksTouched(true);
                  }}
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
              disabled={!validAmount}
              style={{ background: isFullySettled ? "var(--brand-primary)" : "var(--status-partial-text)" }}
            >
              <CheckCircle2 size={16} />
              <span>{isFullySettled ? "Confirm & Mark as Received" : "Record Partial Payment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
