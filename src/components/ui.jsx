import React from "react";

export const Badge = ({ status }) => (
  <span className={`badge badge-${(status || "outstanding").toLowerCase()}`}>{status}</span>
);

export const Empty = ({ title, sub }) => (
  <div className="empty">
    <div className="empty-title">{title}</div>
    {sub && <div className="empty-sub">{sub}</div>}
  </div>
);

export function Field({ label, error, children, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && !error && <div className="sub-line">{hint}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

export const Pips = ({ n, total = 5, color, tall }) => (
  <div className="pips">
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className={`pip ${tall ? "pip-tall" : ""}`} style={i < n ? { background: color } : undefined} />
    ))}
  </div>
);
