import React, { useEffect } from "react";
import { AlertTriangle, Trash2, RotateCcw, X, Info } from "lucide-react";

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger" // "danger" | "warning" | "info"
}) {
  // Handle keyboard events (Enter to confirm, Escape to cancel)
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onConfirm();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onConfirm, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <Trash2 size={20} className="confirm-dialog-icon-danger" />;
      case "warning":
        return <RotateCcw size={20} className="confirm-dialog-icon-warning" />;
      case "info":
      default:
        return <Info size={20} className="confirm-dialog-icon-info" />;
    }
  };

  const getConfirmBtnClass = () => {
    switch (variant) {
      case "danger":
        return "btn btn-danger";
      case "warning":
        return "btn btn-warning";
      case "info":
      default:
        return "btn btn-primary";
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog confirm-dialog-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-body">
          <div className="confirm-dialog-header">
            <div className={`confirm-icon-badge confirm-icon-badge-${variant}`}>
              {getIcon()}
            </div>
            <div className="confirm-dialog-text">
              <h3 className="confirm-dialog-title">{title}</h3>
              <p className="confirm-dialog-desc">{message}</p>
            </div>
          </div>
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${getConfirmBtnClass()} btn-sm`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
