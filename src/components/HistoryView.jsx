import React, { useMemo, useState } from "react";
import { ArrowLeft, History, RotateCcw, Pencil, Search } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  HISTORY_FILTERS,
  eventMatchesFilter,
  eventMatchesQuery,
  actionLabel,
  actionPillClass,
  formatRelativeTime
} from "../utils/changeHistory";

export function HistoryView({ store, onBack, onOpenInvoice, onShowToast }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirm, setConfirm] = useState({ isOpen: false });

  const events = store.historyEvents || [];

  const visible = useMemo(() => {
    return events.filter((e) => eventMatchesFilter(e, filter) && eventMatchesQuery(e, query));
  }, [events, filter, query]);

  const liveById = useMemo(() => {
    const map = new Map();
    (store.invoices || []).forEach((inv) => map.set(inv.id, inv));
    return map;
  }, [store.invoices]);

  const handleOpen = (event) => {
    if (event.action === "imported") {
      onShowToast("Imports are undone as a whole ledger, not opened as one invoice", "info");
      return;
    }
    const live = liveById.get(event.invoiceId);
    if (!live) {
      onShowToast("Deleted — restore to open", "info");
      return;
    }
    onOpenInvoice(live);
  };

  const applyUndo = (event, force = false) => {
    const result = store.undoHistoryEvent(event.id, { force });
    if (result?.ok) {
      onShowToast("Change undone", "success");
      return;
    }
    if (result?.stale) {
      setConfirm({
        isOpen: true,
        title: "This invoice was changed again after this edit",
        message: `${event.invoiceNo || "This invoice"} has been edited since this history row. Restoring anyway will overwrite the later change.`,
        confirmText: "Restore anyway",
        altText: "Open",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: () => applyUndo(event, true),
        onAlt: () => {
          if (result.live) onOpenInvoice(result.live);
        }
      });
      return;
    }
    onShowToast(result?.reason || "Could not undo that change", "error");
  };

  const handleUndo = (event) => {
    if (event.undone) {
      onShowToast("This change is already undone", "info");
      return;
    }
    if (event.action === "imported") {
      if (!Array.isArray(event.before)) {
        onShowToast("This import cannot be undone — the previous ledger was not saved with it", "error");
        return;
      }
      setConfirm({
        isOpen: true,
        title: "Undo this import?",
        message: "This puts the ledger back to how it was before this import. Edits made after the import will be lost.",
        confirmText: "Restore ledger",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: () => applyUndo(event, true)
      });
      return;
    }
    applyUndo(event, false);
  };

  const filterCounts = useMemo(() => {
    const counts = { all: events.length, payments: 0, edits: 0, deletes: 0, imports: 0 };
    events.forEach((e) => {
      if (eventMatchesFilter(e, "payments")) counts.payments += 1;
      if (eventMatchesFilter(e, "edits")) counts.edits += 1;
      if (eventMatchesFilter(e, "deletes")) counts.deletes += 1;
      if (eventMatchesFilter(e, "imports")) counts.imports += 1;
    });
    return counts;
  }, [events]);

  return (
    <section className="history-page" aria-label="Edit history">
      <div className="history-page-header">
        <div className="history-page-title-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={14} />
            <span>Back to ledger</span>
          </button>
          <h2 className="history-page-title">
            <History size={18} />
            History
          </h2>
          <span className="history-page-count">{events.length} change{events.length === 1 ? "" : "s"}</span>
        </div>

        <div className="history-toolbar">
          <div className="segmented-tabs">
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`segmented-tab-btn ${filter === f.value ? "active" : ""}`}
                onClick={() => setFilter(f.value)}
              >
                <span>{f.label}</span>
                <span className="tab-badge">{filterCounts[f.value] || 0}</span>
              </button>
            ))}
          </div>
          <div className="history-search">
            <Search size={13} />
            <input
              type="search"
              className="form-input"
              placeholder="Search invoice # or client"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="history-empty">
          <History size={32} />
          <p className="history-empty-title">No edits recorded yet</p>
          <p>Changes you make from now on will show up here.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="history-empty">
          <p className="history-empty-title">No matching changes</p>
          <p>Try a different filter or search.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="invoice-table history-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Invoice</th>
                <th>Client</th>
                <th>What changed</th>
                <th style={{ textAlign: "right" }}>Manage</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => {
                const live = liveById.get(event.invoiceId);
                const undone = Boolean(event.undone);
                const canOpen =
                  event.action !== "imported" &&
                  Boolean(live);
                const deletedClosed = event.action === "deleted" && !live && !undone;
                const undoDisabled =
                  undone ||
                  (event.action === "imported" && !Array.isArray(event.before));

                return (
                  <tr key={event.id} className={undone ? "history-row-undone" : undefined}>
                    <td>
                      <span
                        className="mono-num"
                        style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}
                        title={event.createdAt}
                      >
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${undone ? "status-cancelled" : actionPillClass(event.action)}`}>
                        {actionLabel(event.action, undone)}
                      </span>
                    </td>
                    <td>
                      <span className="mono-num" style={{ fontWeight: 700 }}>
                        {event.invoiceNo || "—"}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
                      {event.clientName || "—"}
                    </td>
                    <td>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-secondary)" }}>
                        {event.summary}
                      </span>
                      {deletedClosed && (
                        <div className="history-row-hint">Deleted — undo to put it back.</div>
                      )}
                      {undone && (
                        <div className="history-row-hint">This change was undone. Doing it again from the ledger will add a new row.</div>
                      )}
                    </td>
                    <td>
                      <div className="history-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={!canOpen}
                          title={canOpen ? "Open invoice" : "Nothing to open"}
                          onClick={() => handleOpen(event)}
                        >
                          <Pencil size={13} />
                          <span>Open</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={undoDisabled}
                          title={
                            undone
                              ? "Already undone"
                              : undoDisabled
                              ? "This import cannot be undone"
                              : "Undo this change"
                          }
                          onClick={() => handleUndo(event)}
                        >
                          <RotateCcw size={13} />
                          <span>Undo</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(confirm.isOpen)}
        onClose={() => setConfirm({ isOpen: false })}
        onConfirm={confirm.onConfirm || (() => {})}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        cancelText={confirm.cancelText || "Cancel"}
        variant={confirm.variant || "warning"}
        altText={confirm.altText}
        onAlt={confirm.onAlt}
      />
    </section>
  );
}
