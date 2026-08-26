import React, { useMemo } from "react";
import { Users, PieChart, TrendingUp, Zap, Clock, AlertTriangle } from "lucide-react";
import { calculateClientPortfolio, formatCurrency, getClientColor } from "../utils/calculations";

export function ClientPortfolioAnalytics({ store, onSelectClient }) {
  const portfolioData = useMemo(() => {
    return calculateClientPortfolio(store.invoices, store.baseCurrency, store.settings?.exchangeRates);
  }, [store.invoices, store.baseCurrency, store.settings?.exchangeRates]);

  const { clients, clientCount, grandTotalBilled, top3ConcentrationPct } = portfolioData;

  const concentrationRiskLevel =
    top3ConcentrationPct > 65 ? "High Concentration" : top3ConcentrationPct > 45 ? "Moderate" : "Well Diversified";
  const concentrationColor =
    top3ConcentrationPct > 65
      ? "var(--status-overdue-text)"
      : top3ConcentrationPct > 45
      ? "var(--status-pending-text)"
      : "var(--status-received-text)";

  return (
    <div className="client-portfolio-grid">
      {/* 1. Concentration & Distribution Card */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <span className="analytics-card-title">
            <Users size={15} color="var(--brand-primary)" />
            <span>Client Concentration Risk</span>
          </span>
          <span
            className="kpi-badge"
            style={{ color: concentrationColor, borderColor: concentrationColor }}
          >
            {concentrationRiskLevel}
          </span>
        </div>

        <p className="analytics-card-desc">
          Top 3 clients account for <strong style={{ color: "var(--ink-base)" }}>{top3ConcentrationPct}%</strong> of total gross billing ({store.baseCurrency}).
        </p>

        {/* Meter Bar */}
        <div className="concentration-meter-wrapper">
          <div className="concentration-meter-track">
            <div
              className="concentration-meter-fill"
              style={{
                width: `${Math.min(100, top3ConcentrationPct)}%`,
                backgroundColor: concentrationColor
              }}
            />
          </div>
          <div className="concentration-meter-labels">
            <span>0%</span>
            <span>45% (Diversified)</span>
            <span>65% (Risk Threshold)</span>
            <span>100%</span>
          </div>
        </div>

        {/* Top 3 Quick Summary */}
        <div className="top-clients-quick-list">
          {clients.slice(0, 3).map((client, idx) => {
            const avatar = getClientColor(client.name);
            return (
              <div
                key={client.name}
                className="top-client-item"
                onClick={() => onSelectClient && onSelectClient(client.name)}
                title={`Click to filter by ${client.name}`}
              >
                <div className="top-client-left">
                  <span className="top-client-rank">#{idx + 1}</span>
                  <div
                    className="client-avatar-badge"
                    style={{ backgroundColor: avatar.bg, color: avatar.text, borderColor: avatar.border }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="top-client-name">{client.name}</div>
                    <div className="top-client-sub">{client.invoiceCount} invoices · {client.sharePct}% share</div>
                  </div>
                </div>
                <div className="top-client-right mono-num">
                  {formatCurrency(client.totalBilled, store.baseCurrency)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Client Payment Reliability & Leaderboard */}
      <div className="analytics-card">
        <div className="analytics-card-header">
          <span className="analytics-card-title">
            <TrendingUp size={15} color="var(--status-received-text)" />
            <span>Client Reliability & Volume Leaderboard</span>
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {clientCount} Total Clients
          </span>
        </div>

        <p className="analytics-card-desc">
          Ranked by revenue contribution, settlement speed, and payment reliability.
        </p>

        <div className="client-leaderboard-scroll">
          <div className="client-leaderboard-table">
            <div className="client-leaderboard-header">
              <span>Client</span>
              <span>Billed</span>
              <span>Collected</span>
              <span>Outstanding</span>
              <span>Speed / Reliability</span>
            </div>
            {clients.map((client) => {
              const avatar = getClientColor(client.name);
              return (
                <div
                  key={client.name}
                  className="client-leaderboard-row"
                  onClick={() => onSelectClient && onSelectClient(client.name)}
                  title={`Click to filter by ${client.name}`}
                >
                  <div className="client-leaderboard-cell-name">
                    <div
                      className="client-avatar-badge-sm"
                      style={{ backgroundColor: avatar.bg, color: avatar.text, borderColor: avatar.border }}
                    >
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="client-row-title">{client.name}</span>
                  </div>

                  <div className="client-leaderboard-cell mono-num">
                    {formatCurrency(client.totalBilled, store.baseCurrency)}
                  </div>

                  <div className="client-leaderboard-cell mono-num is-collected">
                    {formatCurrency(client.totalCollected, store.baseCurrency)}
                  </div>

                  <div className="client-leaderboard-cell mono-num">
                    {client.totalOutstanding > 0 ? (
                      <span style={{ color: client.totalOverdue > 0 ? "var(--status-overdue-text)" : "inherit" }}>
                        {formatCurrency(client.totalOutstanding, store.baseCurrency)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-muted)" }}>—</span>
                    )}
                  </div>

                  <div className="client-leaderboard-cell">
                    <span className={`reliability-pill ${client.reliabilityClass}`}>
                      {client.avgDaysToCollect !== null ? `${client.avgDaysToCollect}d · ` : ""}
                      {client.reliability}
                    </span>
                  </div>
                </div>
              );
            })}

            {clients.length === 0 && (
              <div className="analytics-empty">No client data recorded</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
