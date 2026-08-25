import React, { useState, useMemo } from "react";
import { X, Users, Plus, Building2, Trash2 } from "lucide-react";
import { CURRENCIES, PAYMENT_TERMS } from "../types/finance";
import { convertToBaseCurrency, formatCurrency, getClientColor } from "../utils/calculations";
import { ConfirmDialog } from "./ConfirmDialog";

export function ClientsModal({
  isOpen,
  onClose,
  store,
  onShowToast
}) {
  const { clients = [], setClients, invoices = [], baseCurrency = "USD", settings } = store || {};
  const rates = settings?.exchangeRates;
  const [isAdding, setIsAdding] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    defaultCurrency: "USD",
    defaultTerms: "Net 30",
    notes: ""
  });

  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    id: null,
    name: ""
  });

  // Client billing statistics
  const clientStats = useMemo(() => {
    const map = {};
    (invoices || []).forEach((inv) => {
      if (!inv) return;
      const name = String(inv.clientName || "").trim() || "Unknown";
      if (!map[name]) {
        map[name] = {
          totalBilledBase: 0,
          totalCollectedBase: 0,
          pendingBase: 0,
          invoiceCount: 0,
          currencies: new Set()
        };
      }
      const baseAmt = convertToBaseCurrency(Number(inv.amount || 0), inv.currency || "USD", baseCurrency, rates);
      map[name].totalBilledBase += baseAmt;
      map[name].invoiceCount += 1;
      map[name].currencies.add(inv.currency || "USD");

      if (inv.status === "Received") {
        const netBase = convertToBaseCurrency(Number(inv.netReceived || inv.amount || 0), inv.currency || "USD", baseCurrency, rates);
        map[name].totalCollectedBase += netBase;
      } else if (inv.status !== "Cancelled" && inv.status !== "Draft") {
        map[name].pendingBase += baseAmt;
      }
    });
    return map;
  }, [invoices, baseCurrency, rates]);

  // Combine explicit clients with any discovered from invoices
  const allDisplayClients = useMemo(() => {
    const list = Array.isArray(clients) ? [...clients] : [];
    const knownNames = new Set(list.map((c) => String(c?.name || "").trim().toLowerCase()));

    // Auto-include clients from invoices that aren't in the directory yet
    (invoices || []).forEach((inv) => {
      const name = String(inv?.clientName || "").trim();
      if (name && !knownNames.has(name.toLowerCase())) {
        knownNames.add(name.toLowerCase());
        list.push({
          id: `c-auto-${name.replace(/\s+/g, "_")}`,
          name,
          email: "",
          defaultCurrency: inv.currency || "USD",
          defaultTerms: "Net 30",
          notes: "Discovered from ledger"
        });
      }
    });

    return list.filter((c) => c && c.name);
  }, [clients, invoices]);

  if (!isOpen) return null;

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;

    const created = {
      id: `c-${Date.now()}`,
      name: newClient.name.trim(),
      email: newClient.email.trim(),
      defaultCurrency: newClient.defaultCurrency || "USD",
      defaultTerms: newClient.defaultTerms || "Net 30",
      notes: newClient.notes.trim()
    };

    if (typeof setClients === "function") {
      setClients((prev) => [...(Array.isArray(prev) ? prev : []), created]);
    }
    setNewClient({
      name: "",
      email: "",
      defaultCurrency: "USD",
      defaultTerms: "Net 30",
      notes: ""
    });
    setIsAdding(false);
    if (typeof onShowToast === "function") {
      onShowToast(`Client "${created.name}" created!`);
    }
  };

  const handleDeleteClient = (id, name) => {
    setDeleteConfirm({
      isOpen: true,
      id,
      name
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm.id && typeof setClients === "function") {
      setClients((prev) => (Array.isArray(prev) ? prev.filter((c) => c.id !== deleteConfirm.id) : []));
      if (typeof onShowToast === "function") {
        onShowToast(`Client "${deleteConfirm.name}" removed`, "delete");
      }
      setDeleteConfirm({ isOpen: false, id: null, name: "" });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Users size={20} />
            </div>
            <div>
              <h2 className="modal-title">Client Directory</h2>
              <p className="modal-subtitle">Manage customer billing profiles, default terms, and total ledger value</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsAdding((p) => !p)}>
              <Plus size={14} />
              <span>{isAdding ? "Cancel" : "Add Client"}</span>
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ overflowY: "auto", flex: 1, padding: "1.25rem" }}>
          {isAdding && (
            <form onSubmit={handleAddClient} style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "1.25rem", marginBottom: "1.5rem" }}>
              <h4 style={{ margin: "0 0 1rem", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--ink-primary)" }}>
                Add New Client
              </h4>
              <div className="form-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Company / Client Name *</label>
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

          {allDisplayClients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--ink-muted)" }}>
              <Building2 size={40} style={{ opacity: 0.4, marginBottom: "0.75rem" }} />
              <div style={{ fontWeight: 600, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>No clients found</div>
              <p style={{ fontSize: "var(--text-sm)", maxWidth: 360, margin: "0.5rem auto 1rem" }}>
                Clients will automatically appear here as you create or import invoices, or you can add them manually.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)}>
                <Plus size={14} />
                <span>Add Your First Client</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
              {allDisplayClients.map((client) => {
                const clientName = String(client?.name || "Client").trim();
                const colors = getClientColor(clientName) || { bg: "var(--bg-surface-elevated)", text: "var(--ink-primary)", border: "var(--border-subtle)" };
                const stats = clientStats[clientName] || {
                  totalBilledBase: 0,
                  totalCollectedBase: 0,
                  pendingBase: 0,
                  invoiceCount: 0,
                  currencies: new Set()
                };

                return (
                  <div
                    key={client.id || clientName}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "var(--radius-sm)",
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "var(--text-sm)"
                          }}
                        >
                          {(clientName || "C").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--ink-primary)" }}>
                            {clientName}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                            {client.email || "No email on file"}
                          </div>
                        </div>
                      </div>
                      {client.id && !client.id.startsWith("c-auto-") && (
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => handleDeleteClient(client.id, clientName)}
                          style={{ color: "var(--ink-faint)" }}
                          title="Delete client"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: "" })}
        onConfirm={handleConfirmDelete}
        title={`Delete client "${deleteConfirm.name}"?`}
        message={`Are you sure you want to remove ${deleteConfirm.name} from your client directory?`}
        confirmText="Delete Client"
        variant="danger"
      />
    </div>
  );
}
