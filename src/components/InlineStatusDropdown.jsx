import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { getEffectiveStatus } from "../utils/calculations";

export function InlineStatusDropdown({
  invoice,
  onUpdateStatus,
  onOpenMarkPaid,
  onShowToast
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (newStatus, e) => {
    e.stopPropagation();
    setIsOpen(false);

    if (newStatus === "MARK_PAID_MODAL") {
      onOpenMarkPaid(invoice);
      return;
    }

    if (newStatus === "Received") {
      const today = new Date().toISOString().split("T")[0];
      const amt = Number(invoice.amount || 0);
      const taxAmt = Number(invoice.taxAmount || 0);
      const netRec = invoice.netReceived || (amt - taxAmt);

      onUpdateStatus(invoice.id, {
        status: "Received",
        receivedOn: invoice.receivedOn || today,
        netReceived: netRec
      });
      onShowToast(`Invoice #${invoice.invoiceNo} marked as Received`);
    } else if (newStatus === "Pending") {
      onUpdateStatus(invoice.id, {
        status: "Pending",
        receivedOn: "",
        netReceived: 0
      });
      onShowToast(`Invoice #${invoice.invoiceNo} marked as Pending`);
    } else if (newStatus === "Cancelled" || newStatus === "Draft" || newStatus === "Duplicate") {
      // Voiding must also clear any recorded receipt, or the cash stays counted as
      // collected while the document reads Cancelled.
      onUpdateStatus(invoice.id, {
        status: newStatus,
        receivedOn: "",
        netReceived: 0
      });
      onShowToast(`Invoice #${invoice.invoiceNo} set to ${newStatus}`);
    } else {
      onUpdateStatus(invoice.id, {
        status: newStatus
      });
      onShowToast(`Invoice #${invoice.invoiceNo} set to ${newStatus}`);
    }
  };

  // Derived centrally, so a Cancelled invoice can never render as Overdue. This
  // component used to run its own date comparison that ignored terminal statuses,
  // which is why changing a past-due invoice to Cancelled appeared to do nothing.
  const effectiveStatus = getEffectiveStatus(invoice);

  const statusClass =
    effectiveStatus === "Received"
      ? "status-received"
      : effectiveStatus === "Overdue"
      ? "status-overdue"
      : effectiveStatus === "Pending"
      ? "status-pending"
      : effectiveStatus === "Cancelled"
      ? "status-cancelled"
      : effectiveStatus === "Duplicate"
      ? "status-duplicate"
      : effectiveStatus === "Suspended"
      ? "status-suspended"
      : "status-draft";

  const displayLabel = effectiveStatus;

  return (
    <div
      ref={dropdownRef}
      className="inline-status-wrapper"
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative", display: "inline-block" }}
    >
      {/* Interactive Status Pill Trigger */}
      <button
        type="button"
        className={`status-pill status-pill-interactive ${statusClass} ${isOpen ? "active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title="Click to change status"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="status-dot"></span>
        <span>{displayLabel}</span>
        <ChevronDown size={11} className={`status-pill-arrow ${isOpen ? "rotated" : ""}`} />
      </button>

      {/* Floating Status Dropdown Menu */}
      {isOpen && (
        <div className="inline-status-menu" role="listbox" onClick={(e) => e.stopPropagation()}>
          <div className="inline-status-menu-header">Change Status</div>

          {/* Option: Received */}
          <button
            type="button"
            className={`inline-status-option ${invoice.status === "Received" ? "selected" : ""}`}
            onClick={(e) => handleSelect("Received", e)}
          >
            <div className="inline-status-option-left">
              <span className="status-dot status-dot-received"></span>
              <div>
                <div className="inline-status-option-title">Received (Paid)</div>
                <div className="inline-status-option-desc">Mark as fully paid & settled</div>
              </div>
            </div>
            {invoice.status === "Received" && <Check size={13} className="inline-status-check" />}
          </button>

          {/* Option: Received with Tax / TDS modal */}
          <button
            type="button"
            className="inline-status-option"
            onClick={(e) => handleSelect("MARK_PAID_MODAL", e)}
          >
            <div className="inline-status-option-left">
              <Sparkles size={12} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
              <div>
                <div className="inline-status-option-title" style={{ color: "var(--brand-primary)" }}>
                  Settle with Tax / TDS...
                </div>
                <div className="inline-status-option-desc">Calculate 15% TDS & custom remittance</div>
              </div>
            </div>
          </button>

          <div className="inline-status-divider" />

          {/* Option: Pending */}
          <button
            type="button"
            className={`inline-status-option ${invoice.status === "Pending" ? "selected" : ""}`}
            onClick={(e) => handleSelect("Pending", e)}
          >
            <div className="inline-status-option-left">
              <span className="status-dot status-dot-pending"></span>
              <div>
                <div className="inline-status-option-title">Pending</div>
                <div className="inline-status-option-desc">Active invoice awaiting remittance</div>
              </div>
            </div>
            {invoice.status === "Pending" && <Check size={13} className="inline-status-check" />}
          </button>

          {/* Option: Overdue */}
          <button
            type="button"
            className={`inline-status-option ${invoice.status === "Overdue" ? "selected" : ""}`}
            onClick={(e) => handleSelect("Overdue", e)}
          >
            <div className="inline-status-option-left">
              <span className="status-dot status-dot-overdue"></span>
              <div>
                <div className="inline-status-option-title">Overdue</div>
                <div className="inline-status-option-desc">Flag payment as past due date</div>
              </div>
            </div>
            {invoice.status === "Overdue" && <Check size={13} className="inline-status-check" />}
          </button>

          {/* Option: Draft */}
          <button
            type="button"
            className={`inline-status-option ${invoice.status === "Draft" ? "selected" : ""}`}
            onClick={(e) => handleSelect("Draft", e)}
          >
            <div className="inline-status-option-left">
              <span className="status-dot status-dot-draft"></span>
              <div>
                <div className="inline-status-option-title">Draft</div>
                <div className="inline-status-option-desc">Unissued invoice draft</div>
              </div>
            </div>
            {invoice.status === "Draft" && <Check size={13} className="inline-status-check" />}
          </button>

          {/* Option: Suspended - still owed, collection paused */}
          <button
            type="button"
            className={`inline-status-option ${invoice.status === "Suspended" ? "selected" : ""}`}
            onClick={(e) => handleSelect("Suspended", e)}
          >
            <div className="inline-status-option-left">
              <span className="status-dot status-dot-pending"></span>
              <div>
                <div className="inline-status-option-title">Suspended</div>
                <div className="inline-status-option-desc">Still owed, collection paused - never flagged overdue</div>
              </div>
            </div>
            {invoice.status === "Suspended" && <Check size={13} className="inline-status-check" />}
          </button>

          {/* Option: Cancelled */}
          <button
            type="button"
            className={`inline-status-option ${invoice.status === "Cancelled" ? "selected" : ""}`}
            onClick={(e) => handleSelect("Cancelled", e)}
          >
            <div className="inline-status-option-left">
              <span className="status-dot" style={{ background: "var(--ink-faint)" }}></span>
              <div>
                <div className="inline-status-option-title">Cancelled</div>
                <div className="inline-status-option-desc">Voided / written off</div>
              </div>
            </div>
            {invoice.status === "Cancelled" && <Check size={13} className="inline-status-check" />}
          </button>
        </div>
      )}
    </div>
  );
}
