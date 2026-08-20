import React, { useState, useMemo } from "react";
import { X, Users, Plus, Building2, Trash2 } from "lucide-react";
import { CURRENCIES, PAYMENT_TERMS } from "../types/finance";
import { convertToBaseCurrency, formatCurrency } from "../utils/calculations";

export function ClientsModal({
  isOpen,
  onClose,
  store,
  onShowToast
}) {
  const { clients, setClients, invoices, baseCurrency } = store;
  const [isAdding, setIsAdding] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    defaultCurrency: "USD",
    defaultTerms: "Net 30",
    notes: ""
  });

  // Client billing statistics
  const clientStats = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      const name = inv.clientName || "Unknown";
      if (!map[name]) {
        map[name] = {
          totalBilledBase: 0,
          totalCollectedBase: 0,
          pendingBase: 0,
          invoiceCount: 0,
          currencies: new Set()
        };
      }
      const baseAmt = convertToBaseCurrency(Number(inv.amount || 0), inv.currency || "USD", baseCurrency);
      map[name].totalBilledBase += baseAmt;
      map[name].invoiceCount += 1;
      map[name].currencies.add(inv.currency || "USD");

      if (inv.status === "Received") {
        const netBase = convertToBaseCurrency(Number(inv.netReceived || inv.amount), inv.currency || "USD", baseCurrency);
        map[name].totalCollectedBase += netBase;
      } else if (inv.status !== "Cancelled" && inv.status !== "Draft") {
        map[name].pendingBase += baseAmt;
      }
    });
    return map;
  }, [invoices, baseCurrency]);

  if (!isOpen) return null;

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;

    const created = {
      id: `c-${Date.now()}`,
      name: newClient.name.trim(),
      email: newClient.email.trim(),
      defaultCurrency: newClient.defaultCurrency,
      defaultTerms: newClient.defaultTerms,
      notes: newClient.notes.trim()
    };

    setClients((prev) => [...prev, created]);
    setNewClient({
      name: "",
      email: "",
      defaultCurrency: "USD",
      defaultTerms: "Net 30",
      notes: ""
    });
    setIsAdding(false);
    onShowToast(`Client "${created.name}" created!`);
  };

  const handleDeleteClient = (id, name) => {
    if (window.confirm(`Delete client "${name}" from directory?`)) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      onShowToast(`Client "${name}" deleted`);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Users size={20} color="var(--brand-primary)" />
            <span>Client Directory & Receivables</span>
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Header Action */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
              {clients.length} Registered Clients
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsAdding(!isAdding)}
            >
              <Plus size={14} />
              <span>{isAdding ? "Cancel" : "Add New Client"}</span>
            </button>
          </div>

          {/* Add Client Form */}
          {isAdding && (
            <form
              onSubmit={handleAddClient}
              style={{
                background: "var(--bg-surface-elevated)",
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)"
              }}
            >
              <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 700, marginBottom: "0.75rem" }}>
                Add New Client Record
              </h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Client / Company Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Acme Corp"
                    value={newClient.name}
                    onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Billing Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="billing@acme.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Currency</label>
                  <select
                    className="form-select"
                    value={newClient.defaultCurrency}
                    onChange={(e) => setNewClient((p) => ({ ...p, defaultCurrency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Terms</label>
                  <select
                    className="form-select"
                    value={newClient.defaultTerms}
                    onChange={(e) => setNewClient((p) => ({ ...p, defaultTerms: e.target.value }))}
                  >
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t.label} value={t.label}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 15% withholding tax applicable"
                    value={newClient.notes}
                    onChange={(e) => setNewClient((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Client
                </button>
              </div>
            </form>
          )}

          {/* Client List Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
            {clients.map((client) => {
              const stats = clientStats[client.name] || {
                totalBilledBase: 0,
                totalCollectedBase: 0,
                pendingBase: 0,
                invoiceCount: 0,
                currencies: new Set()
              };

              return (
                <div
                  key={client.id}
                  style={{
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--brand-surface)",
                          color: "var(--brand-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700
                        }}
                      >
                        <Building2 size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>
                          {client.name}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                          {client.email || "No email on file"}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => handleDeleteClient(client.id, client.name)}
                      style={{ color: "var(--ink-faint)" }}
                      title="Delete client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                      <span style={{ color: "var(--ink-muted)" }}>Total Invoiced:</span>
                      <strong className="mono-num" style={{ color: "var(--ink-primary)" }}>
                        {formatCurrency(stats.totalBilledBase, baseCurrency)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                      <span style={{ color: "var(--ink-muted)" }}>Collected:</span>
                      <strong className="mono-num" style={{ color: "var(--status-received-text)" }}>
                        {formatCurrency(stats.totalCollectedBase, baseCurrency)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                      <span style={{ color: "var(--ink-muted)" }}>Invoices:</span>
                      <span style={{ fontWeight: 600 }}>{stats.invoiceCount} invoices</span>
                    </div>
                  </div>

                  {client.notes && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", fontStyle: "italic" }}>
                      "{client.notes}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
