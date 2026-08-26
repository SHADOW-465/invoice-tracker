import React, { useMemo } from "react";
import { Calendar, CreditCard, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { calculateCashForecast, calculatePaymentChannels, formatCurrency } from "../utils/calculations";

export function ForecastAnalytics({ store, onSelectFilter }) {
  const forecast = useMemo(() => {
    return calculateCashForecast(store.invoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [store.invoices, store.baseCurrency, store.settings?.exchangeRates]);

  const channelData = useMemo(() => {
    return calculatePaymentChannels(store.invoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [store.invoices, store.baseCurrency, store.settings?.exchangeRates]);

  const { slots, totalForecastInflow } = forecast;
  const { channels, totalBilled } = channelData;

  return (
    <div className="forecast-analytics-grid">
      {/* 1. Cash Inflow Projection Timeline */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <span className="analytics-card-title">
            <Calendar size={15} color="var(--brand-primary)" />
            <span>30–90 Day Cash Inflow Forecast</span>
          </span>
          <span className="kpi-badge kpi-badge-success">
            <ArrowUpRight size={11} />
            <span>{formatCurrency(totalForecastInflow, store.baseCurrency)} Expected</span>
          </span>
        </div>

        <p className="analytics-card-desc">
          Expected incoming cash from outstanding invoices mapped by upcoming due dates.
        </p>

        <div className="forecast-timeline-list">
          {slots.map((slot) => {
            const isOverdue = slot.key === "overdue";
            return (
              <div
                key={slot.key}
                className={`forecast-timeline-card ${isOverdue ? "forecast-card-overdue" : ""}`}
                onClick={() => onSelectFilter && onSelectFilter(isOverdue ? "Overdue" : "Pending")}
                title="Click to filter table"
              >
                <div className="forecast-card-header">
                  <span className="forecast-slot-label">{slot.label}</span>
                  <span className="forecast-slot-count">
                    {slot.count} {slot.count === 1 ? "invoice" : "invoices"}
                  </span>
                </div>

                <div className="forecast-card-body">
                  <span className="forecast-slot-amount mono-num">
                    {formatCurrency(slot.amount, store.baseCurrency)}
                  </span>
                  {!isOverdue && (
                    <span className="forecast-slot-pct">{slot.pct}% of pipeline</span>
                  )}
                </div>

                {!isOverdue && (
                  <div className="forecast-progress-bar">
                    <div
                      className="forecast-progress-fill"
                      style={{ width: `${Math.max(4, slot.pct)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Payment Modes & Settlement Channels */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <span className="analytics-card-title">
            <CreditCard size={15} color="var(--status-pending-text)" />
            <span>Payment Channels & Modes</span>
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {channels.length} Methods
          </span>
        </div>

        <p className="analytics-card-desc">
          Volume distribution across client payment settlement channels ({store.baseCurrency}).
        </p>

        <div className="payment-channels-list">
          {channels.map((channel) => (
            <div key={channel.mode} className="payment-channel-row">
              <div className="payment-channel-info">
                <div className="payment-channel-title">
                  <strong>{channel.mode}</strong>
                  <span className="payment-channel-count">
                    {channel.count} {channel.count === 1 ? "invoice" : "invoices"} ({channel.sharePct}%)
                  </span>
                </div>
                <div className="payment-channel-bar">
                  <div
                    className="payment-channel-bar-fill"
                    style={{ width: `${Math.max(4, channel.sharePct)}%` }}
                  />
                </div>
              </div>
              <div className="payment-channel-amounts">
                <div className="mono-num payment-channel-billed">
                  {formatCurrency(channel.totalBilled, store.baseCurrency)}
                </div>
                <div className="mono-num payment-channel-collected is-collected">
                  {formatCurrency(channel.totalCollected, store.baseCurrency)} collected
                </div>
              </div>
            </div>
          ))}

          {channels.length === 0 && (
            <div className="analytics-empty">No payment methods recorded</div>
          )}
        </div>
      </div>
    </div>
  );
}
