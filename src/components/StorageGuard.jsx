import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  HardDriveDownload,
  RotateCcw,
  FileSpreadsheet,
  LifeBuoy,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { exportToExcel } from "../utils/excelHandler";
import { ConfirmDialog } from "./ConfirmDialog";

const fmtBytes = (n) => {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
};

const fmtAgo = (ts) => {
  if (!ts) return "unknown time";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "moments ago";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${Math.round(hrs / 24)} day${Math.round(hrs / 24) === 1 ? "" : "s"} ago`;
};

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Everything the user sees when storage misbehaves.
 *
 * Two very different situations, deliberately handled differently:
 *
 *  - "corrupt": the saved ledger could not be read. This BLOCKS the app, because
 *    letting someone carry on working would write over data they might still
 *    recover. Nothing is written until they pick an option.
 *  - "quota" / "unavailable": the data is fine in memory but the last save did
 *    not land. This does NOT block - it warns persistently and pushes them to
 *    export, because the worst outcome is closing the app unaware.
 */
export function StorageGuard({ store, onShowToast }) {
  const status = store.storageState?.status || "ok";
  if (status === "ok") return null;

  // Only a failure to LOAD blocks the app - at that point continuing would write
  // over recoverable data. A failure to SAVE always stays non-blocking, because
  // the one thing that rescues the situation is exporting, and that needs the
  // interface to remain usable.
  if (status === "corrupt" || status === "unavailable") {
    return <RecoveryCard store={store} onShowToast={onShowToast} />;
  }
  return <SaveFailureBanner store={store} onShowToast={onShowToast} />;
}

/* ------------------------------------------------------------ blocking card */

function RecoveryCard({ store, onShowToast }) {
  const { storageState } = store;
  const isCorrupt = storageState.status === "corrupt";

  const [scanning, setScanning] = useState(isCorrupt);
  const [options, setOptions] = useState({ mirror: null, salvage: null });
  const [confirmFresh, setConfirmFresh] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isCorrupt) return undefined;
    (async () => {
      const found = await store.inspectRecoveryOptions();
      if (!cancelled) {
        setOptions(found);
        setScanning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isCorrupt, store]);

  const handleRestoreMirror = () => {
    const res = store.restoreFromMirror(options.mirror.value);
    if (res.ok) onShowToast(`Restored ${res.invoiceCount} invoices from the automatic backup`, "success");
    else onShowToast(res.reason || "Could not restore that copy", "error");
  };

  const handleSalvage = () => {
    const res = store.restoreFromSalvage(options.salvage.invoices);
    if (res.ok) onShowToast(`Recovered ${res.invoiceCount} invoices from the damaged file`, "success");
    else onShowToast(res.reason || "Nothing could be recovered", "error");
  };

  const handleDownloadDamaged = () => {
    const raw = store.getQuarantinedRaw();
    if (!raw) {
      onShowToast("The damaged file is no longer available to download", "error");
      return;
    }
    downloadText(raw, `invoice-ledger-damaged-${new Date().toISOString().slice(0, 10)}.json`);
    onShowToast("Damaged file downloaded. Keep it somewhere safe.", "success");
  };

  const handleSalvageToExcel = () => {
    try {
      exportToExcel(options.salvage.invoices, `Recovered_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
      onShowToast("Recovered invoices exported to Excel", "success");
    } catch {
      onShowToast("Could not build the Excel file", "error");
    }
  };

  return (
    <div className="storage-guard-overlay" role="alertdialog" aria-modal="true" aria-labelledby="sg-title">
      <div className="storage-guard-card">
        <div className="storage-guard-head">
          <div className="storage-guard-icon">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="storage-guard-title" id="sg-title">
              {isCorrupt ? "Your ledger could not be opened" : "Saving is unavailable on this device"}
            </h2>
            <p className="storage-guard-sub">
              {isCorrupt
                ? "The saved invoice file is damaged, so it was not loaded."
                : "This browser or device is not allowing the app to save data."}
            </p>
          </div>
        </div>

        {/* What this means, in plain words. */}
        <div className="storage-guard-explain">
          {isCorrupt ? (
            <>
              <p>
                <strong>Nothing has been deleted.</strong> The damaged file has been set aside
                exactly as it was, and the app has stopped saving so it cannot be written over.
              </p>
              <p className="storage-guard-detail">
                Technical detail: {storageState.detail}
                {storageState.rawBytes ? ` (${fmtBytes(storageState.rawBytes)} set aside)` : ""}
              </p>
            </>
          ) : (
            <>
              <p>
                You can keep working, but <strong>nothing will be saved</strong>. This usually means
                private browsing mode, a full disk, or browser settings blocking storage for this app.
              </p>
              <p className="storage-guard-detail">Technical detail: {storageState.detail}</p>
            </>
          )}
        </div>

        {isCorrupt && (
          <div className="storage-guard-options">
            <div className="storage-guard-options-label">
              {scanning ? "Checking for recoverable copies…" : "Choose how to continue"}
            </div>

            {scanning && (
              <div className="storage-option storage-option-scanning">
                <Loader2 size={16} className="spin" />
                <span>Looking through the automatic backup and the damaged file…</span>
              </div>
            )}

            {!scanning && (
              <>
                {/* Best case: a clean second copy. */}
                {options.mirror && (
                  <div className="storage-option storage-option-best">
                    <div className="storage-option-rank">1</div>
                    <div className="storage-option-body">
                      <div className="storage-option-title">
                        <LifeBuoy size={14} /> Restore the automatic backup
                        <span className="storage-option-tag">Recommended</span>
                      </div>
                      <p>
                        A complete second copy with <strong>{options.mirror.invoiceCount} invoices</strong>,
                        saved {fmtAgo(options.mirror.savedAt)}. Any changes made after that time will
                        need re-entering.
                      </p>
                    </div>
                    <button className="btn btn-primary" onClick={handleRestoreMirror}>
                      <RotateCcw size={13} /> Restore
                    </button>
                  </div>
                )}

                {/* Next best: pull whole records out of the damaged blob. */}
                {options.salvage && (
                  <div className="storage-option">
                    <div className="storage-option-rank">{options.mirror ? 2 : 1}</div>
                    <div className="storage-option-body">
                      <div className="storage-option-title">
                        <HardDriveDownload size={14} /> Rebuild from the damaged file
                      </div>
                      <p>
                        <strong>{options.salvage.invoiceCount} invoices</strong> can still be read out of
                        the damaged file. Records at the very end may be missing.
                      </p>
                      <button className="storage-option-link" onClick={handleSalvageToExcel}>
                        Export these to Excel first
                      </button>
                    </div>
                    <button className="btn btn-secondary" onClick={handleSalvage}>
                      <RotateCcw size={13} /> Recover
                    </button>
                  </div>
                )}

                {!options.mirror && !options.salvage && (
                  <div className="storage-option storage-option-empty">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>No recoverable copy was found.</strong>
                      <p>
                        Download the damaged file below and keep it. If you have an Excel export from
                        earlier, start fresh and import it.
                      </p>
                    </div>
                  </div>
                )}

                {/* Always available: keep the evidence. */}
                <div className="storage-option">
                  <div className="storage-option-rank">{1 + (options.mirror ? 1 : 0) + (options.salvage ? 1 : 0)}</div>
                  <div className="storage-option-body">
                    <div className="storage-option-title">
                      <FileSpreadsheet size={14} /> Download the damaged file
                    </div>
                    <p>Save a copy before changing anything, so it can be examined later.</p>
                  </div>
                  <button className="btn btn-secondary" onClick={handleDownloadDamaged}>
                    Download
                  </button>
                </div>

                <div className="storage-option storage-option-danger">
                  <div className="storage-option-body">
                    <div className="storage-option-title">
                      <Trash2 size={14} /> Start with an empty ledger
                    </div>
                    <p>
                      Discards the damaged file permanently. Only do this once you have downloaded it
                      or have an Excel export to import.
                    </p>
                  </div>
                  <button className="btn btn-danger" onClick={() => setConfirmFresh(true)}>
                    Start fresh
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="storage-guard-foot">
          {isCorrupt
            ? "Saving stays switched off until you choose one of the options above."
            : "Export to Excel regularly while this message is showing."}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmFresh}
        onClose={() => setConfirmFresh(false)}
        onConfirm={() => {
          store.discardAndStartFresh();
          onShowToast("Started a new empty ledger", "info");
        }}
        title="Permanently discard the damaged file?"
        message="The damaged invoice data will be deleted and cannot be recovered afterwards. Make sure you have downloaded it, or have an Excel export you can import."
        confirmText="Discard and start fresh"
        variant="danger"
      />
    </div>
  );
}

/* --------------------------------------------------------- non-blocking bar */

function SaveFailureBanner({ store, onShowToast }) {
  const { storageState } = store;
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    try {
      exportToExcel(
        store.invoices,
        `Invoice_Ledger_RESCUE_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      store.markBackedUp();
      onShowToast("Exported. Your invoices are now safe in that file.", "success");
    } catch {
      onShowToast("Could not build the Excel file", "error");
    }
  };

  const handleRetry = () => {
    setBusy(true);
    const res = store.retrySave();
    setBusy(false);
    if (res.ok) onShowToast("Saved successfully. You are back to normal.", "success");
    else onShowToast("Still cannot save. Export to Excel and free up space.", "error");
  };

  return (
    <div className="save-failure-card" role="alert">
      <div className="save-failure-icon">
        <AlertTriangle size={18} />
      </div>

      <div className="save-failure-body">
        <div className="save-failure-title">Your recent changes have not been saved</div>
        <p className="save-failure-text">
          {storageState.kind === "quota"
            ? "This device has run out of space for the app to store your ledger."
            : "The app was blocked from writing to this device's storage."}{" "}
          Everything on screen is still correct, but it only exists in this window right now —
          <strong> closing the app would lose it.</strong>
        </p>

        <ol className="save-failure-steps">
          <li>
            <strong>Export to Excel now.</strong> This writes a real file to your computer and is the
            only step that makes your data safe.
          </li>
          <li>
            {storageState.kind === "quota"
              ? "Delete ledgers you no longer need, or clear old browser data to free space."
              : "Check that this app is allowed to store data, and that you are not in private browsing."}
          </li>
          <li>Press <strong>Try saving again</strong>. If it succeeds, this message disappears.</li>
        </ol>

        {storageState.usageBytes ? (
          <div className="save-failure-meta">
            Currently stored: {fmtBytes(storageState.usageBytes)} · last attempt needed{" "}
            {fmtBytes(storageState.attemptedBytes)}
          </div>
        ) : null}
      </div>

      <div className="save-failure-actions">
        <button className="btn btn-primary" onClick={handleExport}>
          <FileSpreadsheet size={13} /> Export to Excel
        </button>
        <button className="btn btn-secondary" onClick={handleRetry} disabled={busy}>
          {busy ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />} Try saving again
        </button>
        {store.lastSavedAt && (
          <span className="save-failure-lastsaved">
            <CheckCircle2 size={11} /> Last successful save {fmtAgo(store.lastSavedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
