import React, { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../utils/calculations";

export function TrendChart({ series = [], currency = "USD" }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let idx = series.length - 1;
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if ((series[i].invoiced || 0) > 0 || (series[i].received || 0) > 0) {
        idx = i;
        break;
      }
    }
    setSelected(Math.max(0, idx));
  }, [series]);

  const maxVal = useMemo(() => {
    if (series.length === 0) return 1000;
    return Math.max(...series.map((c) => Math.max(c.invoiced || 0, c.received || 0)), 100) * 1.15;
  }, [series]);

  if (series.length === 0) {
    return <div className="analytics-empty">No invoice activity recorded</div>;
  }

  const active = series[selected] || series[0];

  return (
    <div className="trend-chart">
      <div
        className="analytics-chart-container"
        role="listbox"
        aria-label="Billed versus collected by period"
      >
        {series.map((item, idx) => {
          const invoicedScale = Math.max(6 / 110, (item.invoiced || 0) / maxVal);
          const receivedScale = Math.max(6 / 110, (item.received || 0) / maxVal);
          const isSelected = idx === selected;

          return (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`analytics-chart-col ${isSelected ? "is-selected" : ""}`}
              onClick={() => setSelected(idx)}
            >
              <div className="analytics-bars-pair">
                <div
                  className="analytics-bar"
                  style={{
                    "--bar-scale": invoicedScale,
                    backgroundColor: "var(--chart-bar-invoiced)"
                  }}
                />
                <div
                  className="analytics-bar"
                  style={{
                    "--bar-scale": receivedScale,
                    backgroundColor: "var(--chart-bar-collected)"
                  }}
                />
              </div>
              <span className="analytics-chart-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="analytics-readout">
        <div className="analytics-readout-period">{active.label}</div>
        <div className="analytics-readout-metrics">
          <div className="analytics-readout-metric">
            <span className="analytics-readout-label">Billed</span>
            <span className="analytics-readout-value mono-num">
              {formatCurrency(active.invoiced || 0, currency)}
            </span>
          </div>
          <div className="analytics-readout-metric is-collected">
            <span className="analytics-readout-label">Collected</span>
            <span className="analytics-readout-value mono-num">
              {formatCurrency(active.received || 0, currency)}
            </span>
          </div>
          <div className="analytics-readout-metric">
            <span className="analytics-readout-label">Invoices</span>
            <span className="analytics-readout-value mono-num">{active.count || 0}</span>
          </div>
        </div>
      </div>
      <p className="analytics-readout-hint">Click a month or year on the chart to see its amounts.</p>
    </div>
  );
}
