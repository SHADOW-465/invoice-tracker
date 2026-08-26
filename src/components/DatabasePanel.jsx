import React, { useCallback, useEffect, useState } from "react";
import { Database, HardDrive, RotateCcw, FolderOpen, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";

const fmtBytes = (n) => {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

const fmtWhen = (ts) => {
  if (!ts) return "unknown";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
};

/**
 * Where the ledger actually lives, and how to get it back.
 *
 * Backups only reassure if you can see them, so this lists real files with real
 * sizes and timestamps rather than promising that something happens in the dark.
 */
export function DatabasePanel({ store, onShowToast }) {
  const [stats, setStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null);

  const refresh = useCallback(async () => {
    if (!store.isDesktop) return;
    const [s, b] = await Promise.all([store.ledgerStats(), store.getBackups()]);
    setStats(s);
    setBackups(b || []);
  }, [store]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!store.isDesktop) {
    return (
      <div className="db-panel">
        <div className="db-panel-row db-panel-warn">
          <AlertTriangle size={15} />
          <div>
            <strong>Running in a browser — storage is limited.</strong>
            <p>
              The desktop app keeps your ledger in a database file with automatic backups.
              In a browser it lives in browser storage, which has a size limit and is cleared
              if you clear site data. Export to Excel regularly here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleBackup = async () => {
    setBusy(true);
    const res = await store.createBackup("manual");
    setBusy(false);
    if (res.ok) {
      onShowToast(`Backup created (${fmtBytes(res.data.bytes)})`, "success");
      refresh();
    } else {
      onShowToast(res.detail || "Backup failed", "error");
    }
  };

  const handleRestore = async (backup) => {
    setBusy(true);
    const res = await store.restoreDatabaseBackup(backup.path);
    setBusy(false);
    if (res.ok) {
      onShowToast(`Restored ${res.invoiceCount} invoices from ${fmtWhen(backup.savedAt)}`, "success");
      refresh();
    } else {
      onShowToast(res.detail || "Restore failed", "error");
    }
  };

  return (
    <div className="db-panel">
      <div className="db-panel-row">
        <Database size={15} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong>SQLite database</strong>
          <p>
            {stats ? `${stats.invoices.toLocaleString()} invoices · ${fmtBytes(stats.bytes)}` : "Reading…"}
          </p>
          {stats && <code className="db-panel-path" title={stats.dbPath}>{stats.dbPath}</code>}
        </div>
        <span className="db-panel-badge">
          <ShieldCheck size={11} /> Transactional
        </span>
      </div>

      <div className="db-panel-actions">
        <button className="btn btn-secondary btn-sm" onClick={handleBackup} disabled={busy}>
          {busy ? <Loader2 size={12} className="spin" /> : <HardDrive size={12} />}
          <span>Back up now</span>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => store.revealBackups()}>
          <FolderOpen size={12} />
          <span>Open backups folder</span>
        </button>
      </div>

      <div className="db-panel-label">
        Automatic backups ({backups.length}) — one is taken every time the app starts
      </div>

      {backups.length === 0 ? (
        <div className="db-panel-empty">No backups yet. One is created the next time the app starts.</div>
      ) : (
        <div className="db-backup-list">
          {backups.slice(0, 8).map((b) => (
            <div key={b.path} className="db-backup-row">
              <div className="db-backup-when">{fmtWhen(b.savedAt)}</div>
              <div className="db-backup-size">{fmtBytes(b.bytes)}</div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => setConfirmRestore(b)}
                title="Replace the current ledger with this snapshot"
              >
                <RotateCcw size={11} />
                <span>Restore</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        onConfirm={() => { const b = confirmRestore; setConfirmRestore(null); handleRestore(b); }}
        title="Restore this backup?"
        message={
          confirmRestore
            ? `Your current ledger will be replaced with the snapshot from ${fmtWhen(confirmRestore.savedAt)}. ` +
              `A backup of the current state is taken first, so this can be undone.`
            : ""
        }
        confirmText="Restore backup"
        variant="danger"
      />
    </div>
  );
}
