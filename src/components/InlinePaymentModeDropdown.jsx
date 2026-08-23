import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { PAYMENT_MODES } from "../types/finance";

export function InlinePaymentModeDropdown({
  invoice,
  onUpdateMode,
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

  const handleSelect = (mode, e) => {
    e.stopPropagation();
    setIsOpen(false);
    onUpdateMode(invoice.id, { paymentMode: mode.value });
    onShowToast(`Updated payment mode to ${mode.value}`);
  };

  const currentMode = invoice.paymentMode || "Online";

  return (
    <div
      ref={dropdownRef}
      className="inline-mode-wrapper"
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        className={`payment-mode-tag payment-mode-interactive ${isOpen ? "active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title="Click to change payment mode"
      >
        <span>{currentMode}</span>
        <ChevronDown size={10} className={`status-pill-arrow ${isOpen ? "rotated" : ""}`} />
      </button>

      {isOpen && (
        <div className="inline-status-menu inline-mode-menu" role="listbox" onClick={(e) => e.stopPropagation()}>
          <div className="inline-status-menu-header">Payment Mode</div>
          {PAYMENT_MODES.map((m) => {
            const isSelected = (m.value || m) === currentMode;
            const label = m.label || m;
            const val = m.value || m;

            return (
              <button
                key={val}
                type="button"
                className={`inline-status-option ${isSelected ? "selected" : ""}`}
                onClick={(e) => handleSelect({ value: val, label }, e)}
              >
                <span className="inline-status-option-title">{label}</span>
                {isSelected && <Check size={13} className="inline-status-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
