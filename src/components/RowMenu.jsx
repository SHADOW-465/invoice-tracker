import React, { useEffect, useState } from "react";

/**
 * The per-row action menu the old single-page version had inline: edit, duplicate,
 * record payment, PDF, delete — without leaving the ledger. Destructive items ask once.
 */
export function RowMenu({ items, label = "Row actions" }) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(null);

  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setArmed(null); };
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stop = (e) => e.stopPropagation();

  const choose = (item) => (e) => {
    e.stopPropagation();
    if (item.danger && armed !== item.label) return setArmed(item.label);
    setOpen(false);
    setArmed(null);
    item.onClick();
  };

  return (
    <div className="row-menu" onClick={stop}>
      <button
        className="icon-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => { stop(e); setOpen((o) => !o); setArmed(null); }}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={(e) => { stop(e); setOpen(false); setArmed(null); }} />
          <div className="menu" role="menu">
            {items.filter(Boolean).map((item) => (
              <button
                key={item.label}
                role="menuitem"
                className={`menu-item ${item.danger ? "danger" : ""} ${armed === item.label ? "armed" : ""}`}
                onClick={choose(item)}
              >
                <span className="menu-glyph">{item.glyph}</span>
                {armed === item.label ? "Click again to confirm" : item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
