// State Management & LocalStorage Persistence Hook
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { INITIAL_INVOICES, INITIAL_CLIENTS } from "../types/finance";
import {
  loadLedger,
  persistInvoiceChanges,
  persistReplaceInvoices,
  persistWorkspaceMeta,
  removeWorkspace as removeWorkspaceRow,
  persistClients,
  persistSettings,
  snapshotInvoices,
  diffInvoices,
  isDesktop,
  backendName,
  makeBackup,
  listBackups,
  restoreBackup as restoreBackupFile,
  revealBackups,
  ledgerStats
} from "../utils/ledgerStore";
import {
  STORAGE_KEYS,
  safeRead,
  safeWrite,
  isValidWorkspaces,
  quarantine,
  mirrorWrite,
  mirrorRead,
  estimateUsage,
  readQuarantined,
  clearQuarantined,
  salvageInvoices
} from "../utils/storage";
import {
  getMonthName,
  calculateDueDate,
  calculateAging,
  getEffectiveStatus,
  isReceivable,
  getPeriod,
  getAgingBucket,
  hasTaxDeduction,
  getAvailableYears,
  getUsedCurrencies
} from "../utils/calculations";

const DEFAULT_SETTINGS = {
  companyName: "Simon & Son Global",
  companyEmail: "accounts@simonandson.com",
  companyAddress: "Navalur, OMR Road, Chennai, Tamil Nadu 600130",
  taxId: "IN-33AAACS1234F1Z5",
  invoicePrefix: "SnS",
  defaultPaymentTerms: "Net 30",
  defaultCurrency: "USD",
  bankDetails: "HDFC Bank\nAccount: 5020-0012-3456-78\nIFSC: HDFC0001234\nBranch: Navalur, Chennai",
  // Value of one unit of each currency expressed in USD. Editable in Settings -
  // every base-currency total on the dashboard depends on these, so leaving them
  // hard-coded meant the headline numbers could not be corrected.
  exchangeRates: {
    USD: 1.0,
    EUR: 1.08,
    GBP: 1.28,
    CHF: 1.14,
    INR: 0.012,
    AED: 0.272,
    SAR: 0.266,
    ZAR: 0.0545,
    NZD: 0.595,
    MXN: 0.0495,
    CAD: 0.74,
    AUD: 0.66,
    SGD: 0.75
  }
};

const freshWorkspace = (invoices = INITIAL_INVOICES) => ([
  { id: "default", name: "Master Ledger", invoices, createdAt: new Date().toISOString() }
]);

export function useFinanceStore() {
  /*
   * The ledger now lives in SQLite on the desktop, which means loading it is
   * asynchronous. The interface renders a loading state until the first read
   * completes rather than rendering an empty ledger that would look like data loss.
   */
  const [isLoading, setIsLoading] = useState(true);

  // 1. Workspaces state (Multi-Ledger Support)
  const [workspaces, setWorkspaces] = useState(() => freshWorkspace([]));
  const [storageState, setStorageState] = useState({ status: "ok" });
  const [migrationReport, setMigrationReport] = useState(null);
  const [dbInfo, setDbInfo] = useState(null);

  /*
   * Fingerprints of what is already on disk, so a save sends only the rows that
   * actually changed. Flipping one status writes one row instead of rewriting
   * every invoice in the ledger.
   */
  const persistedRef = useRef(new Map());
  const hydratedRef = useRef(false);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE) || "default";
    } catch (e) {
      return "default";
    }
  });

  // Writing is blocked entirely while storage is in a state we do not understand,
  // so nothing can overwrite bytes the user might still recover from.
  const writesBlocked = storageState.status === "corrupt";

  // Open the ledger once on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await loadLedger();
      if (cancelled) return;

      setWorkspaces(result.workspaces);
      setClients(result.clients && result.clients.length ? result.clients : INITIAL_CLIENTS);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(result.settings || {}),
        exchangeRates: {
          ...DEFAULT_SETTINGS.exchangeRates,
          ...((result.settings && result.settings.exchangeRates) || {})
        }
      });
      setStorageState(result.storage || { status: "ok" });
      if (result.migration) setMigrationReport(result.migration);
      if (result.dbPath) setDbInfo({ path: result.dbPath, backend: backendName() });

      const active = result.workspaces.find((w) => w.id === activeWorkspaceId) || result.workspaces[0];
      persistedRef.current = snapshotInvoices(active ? active.invoices : []);
      hydratedRef.current = true;
      setIsLoading(false);
    })();

    return () => { cancelled = true; };
    // Intentionally runs once: the ledger is loaded at startup, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Current active workspace
  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0] || {
      id: "default",
      name: "Master Ledger",
      invoices: []
    };
  }, [workspaces, activeWorkspaceId]);

  const invoices = useMemo(() => activeWorkspace.invoices || [], [activeWorkspace]);

  // Updater for active workspace's invoices
  const setInvoices = useCallback((updater) => {
    setWorkspaces(prev => {
      return prev.map(w => {
        if (w.id === activeWorkspaceId) {
          const nextInvoices = typeof updater === "function" ? updater(w.invoices || []) : updater;
          return { ...w, invoices: nextInvoices };
        }
        return w;
      });
    });
  }, [activeWorkspaceId]);

  // 2. Clients state
  const [clients, setClients] = useState(INITIAL_CLIENTS);

  // 3. Settings state
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // 4. Base Currency state
  const [baseCurrency, setBaseCurrency] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.BASE_CURRENCY) || "USD";
    } catch (e) {
      return "USD";
    }
  });

  // 5. Theme state
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) || "dark";
    } catch (e) {
      return "dark";
    }
  });

  // 6. Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [invoiceNoFilter, setInvoiceNoFilter] = useState("");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [agingFilter, setAgingFilter] = useState("all");
  const [taxFilter, setTaxFilter] = useState("all");
  const [settledFilter, setSettledFilter] = useState("all");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sortField, setSortField] = useState("raisedOn");
  const [sortDirection, setSortDirection] = useState("desc");

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setCurrencyFilter("all");
    setMonthFilter("all");
    setYearFilter("all");
    setClientFilter("all");
    setInvoiceNoFilter("");
    setPaymentModeFilter("all");
    setAgingFilter("all");
    setTaxFilter("all");
    setSettledFilter("all");
    setAmountMin("");
    setAmountMax("");
  }, []);

  const [lastSavedAt, setLastSavedAt] = useState(null);

  /*
   * Persist invoices by difference.
   *
   * On SQLite each save is a transaction touching only changed rows, so a partial
   * write can no longer damage the rest of the ledger - the failure mode the old
   * single-JSON-blob design made unavoidable.
   */
  useEffect(() => {
    if (writesBlocked || !hydratedRef.current) return;

    const active = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
    if (!active) return;

    const delta = diffInvoices(persistedRef.current, active.invoices || []);
    if (!delta.changed) return;

    let cancelled = false;
    (async () => {
      const result = await persistInvoiceChanges(active.id, delta, workspaces);
      if (cancelled) return;

      if (result.ok) {
        persistedRef.current = snapshotInvoices(active.invoices || []);
        setLastSavedAt(Date.now());
        setStorageState((prev) => (prev.status === "ok" ? prev : { status: "ok" }));
        return;
      }

      console.error("Failed to persist invoices", result.detail);
      // A failure while SAVING never blocks the app: the data is still in memory
      // and exporting is the way out, which needs the interface reachable.
      setStorageState({
        status: "save-failed",
        kind: result.kind,
        detail: result.detail || "Unknown storage error",
        attemptedBytes: result.attemptedBytes || 0,
        usageBytes: result.usageBytes || 0
      });
    })();

    return () => { cancelled = true; };
  }, [workspaces, activeWorkspaceId, writesBlocked]);

  // Ledger names/creation are metadata, saved separately from the invoice rows.
  useEffect(() => {
    if (writesBlocked || !hydratedRef.current) return;
    persistWorkspaceMeta(workspaces);
  }, [workspaces, writesBlocked]);

  useEffect(() => {
    if (writesBlocked || !hydratedRef.current) return;
    persistClients(clients);
  }, [clients, writesBlocked]);

  useEffect(() => {
    if (writesBlocked || !hydratedRef.current) return;
    persistSettings(settings);
  }, [settings, writesBlocked]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BASE_CURRENCY, baseCurrency);
    } catch (e) {
      console.error("Failed to persist base currency", e);
    }
  }, [baseCurrency]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
      console.error("Failed to persist theme", e);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Workspace / Ledger Switcher & Management
  const createWorkspace = useCallback((name, initialInvoices = []) => {
    const newId = `ws_${Date.now()}`;
    const newWs = {
      id: newId,
      name: name.trim() || "Untitled Ledger",
      invoices: initialInvoices,
      createdAt: new Date().toISOString()
    };
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newId);
    return newId;
  }, []);

  const switchWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
  }, []);

  const deleteWorkspace = useCallback((id) => {
    // Remove the rows as well; the metadata effect only ever upserts, so without
    // this the ledger would reappear on the next launch.
    removeWorkspaceRow(id);
    // Resolve the next active ledger from the same update that removes the old one,
    // rather than from a `workspaces` value captured when this callback was created.
    setWorkspaces(prev => {
      const next = prev.length <= 1
        ? [{ id: "default", name: "Master Ledger", invoices: [], createdAt: new Date().toISOString() }]
        : prev.filter(w => w.id !== id);
      setActiveWorkspaceId(prevId => (prevId === id ? (next[0]?.id || "default") : prevId));
      return next;
    });
  }, []);

  const renameWorkspace = useCallback((id, newName) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: newName.trim() || w.name } : w));
  }, []);

  const clearCurrentLedger = useCallback(() => {
    setInvoices([]);
  }, [setInvoices]);

  const resetToSampleData = useCallback(() => {
    setInvoices(INITIAL_INVOICES);
    setClients(INITIAL_CLIENTS);
    setSettings(DEFAULT_SETTINGS);
  }, [setInvoices]);

  const importInvoices = useCallback((newInvoices, mode = "merge", workspaceName = null) => {
    if (mode === "new_workspace") {
      const name = workspaceName || `Ledger (${new Date().toLocaleDateString()})`;
      createWorkspace(name, newInvoices);
    } else if (mode === "replace") {
      // Replacing means deleting rows the diff would never notice were gone, so
      // let the store do it in one transaction and re-seed the fingerprints.
      persistReplaceInvoices(activeWorkspaceId, newInvoices, workspaces).then((r) => {
        if (r.ok) persistedRef.current = snapshotInvoices(newInvoices);
      });
      setInvoices(newInvoices);
    } else {
      // Merge by invoiceNo
      setInvoices(prev => {
        const existingMap = new Map(prev.map(i => [i.invoiceNo.toLowerCase(), i]));
        newInvoices.forEach(newItem => {
          existingMap.set(newItem.invoiceNo.toLowerCase(), newItem);
        });
        return Array.from(existingMap.values());
      });
    }
  }, [createWorkspace, setInvoices, activeWorkspaceId, workspaces]);

  // Helper to suggest next invoice number
  const getNextInvoiceNumber = useCallback(() => {
    const prefix = settings.invoicePrefix || "SnS";
    // Only numbers already in this prefix series count. The previous version seeded
    // from a hard-coded 2534, so any ledger numbered below that jumped straight to
    // SnS02535 and left a gap of thousands.
    const series = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`, "i");
    let maxNum = 0;
    let width = 5;

    invoices.forEach(inv => {
      const match = series.exec(String(inv.invoiceNo || "").trim());
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
          width = Math.max(width, match[1].length);
        }
      }
    });

    return `${prefix}${String(maxNum + 1).padStart(width, "0")}`;
  }, [invoices, settings.invoicePrefix]);

  // Actions
  const addInvoice = useCallback((invoiceData) => {
    const raisedOn = invoiceData.raisedOn || new Date().toISOString().split("T")[0];
    const invoicedMonth = invoiceData.invoicedMonth || getMonthName(raisedOn);
    const dueDate = invoiceData.dueDate || calculateDueDate(raisedOn, 30);
    const invoiceNo = invoiceData.invoiceNo?.trim() || getNextInvoiceNumber();

    const newInvoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...invoiceData,
      invoiceNo,
      raisedOn,
      invoicedMonth,
      dueDate,
      amount: parseFloat(invoiceData.amount || 0),
      taxRate: parseFloat(invoiceData.taxRate || 0),
      taxAmount: parseFloat(invoiceData.taxAmount || 0),
      netReceived: parseFloat(invoiceData.netReceived || (invoiceData.status === "Received" ? invoiceData.amount : 0)),
      status: invoiceData.status || "Pending",
      currency: invoiceData.currency || settings.defaultCurrency || "USD",
      paymentMode: invoiceData.paymentMode || "Online"
    };

    setInvoices(prev => [newInvoice, ...prev]);

    // Check if client exists, if not add to clients
    if (invoiceData.clientName) {
      setClients(prevClients => {
        const exists = prevClients.some(c => c.name.toLowerCase() === invoiceData.clientName.toLowerCase());
        if (!exists) {
          return [
            ...prevClients,
            {
              id: `c-${Date.now()}`,
              name: invoiceData.clientName,
              email: "",
              defaultCurrency: invoiceData.currency || "USD",
              defaultTerms: invoiceData.paymentTerms || "Net 30",
              notes: "Auto-created from invoice"
            }
          ];
        }
        return prevClients;
      });
    }

    return newInvoice;
  }, [getNextInvoiceNumber, settings.defaultCurrency, setInvoices]);

  const updateInvoice = useCallback((id, updatedFields) => {
    setInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== id) return inv;
        const merged = { ...inv, ...updatedFields };
        if (updatedFields.raisedOn && !updatedFields.invoicedMonth) {
          merged.invoicedMonth = getMonthName(updatedFields.raisedOn);
        }
        if (updatedFields.amount !== undefined) {
          merged.amount = parseFloat(updatedFields.amount || 0);
        }
        if (updatedFields.taxRate !== undefined) {
          merged.taxRate = parseFloat(updatedFields.taxRate || 0);
          merged.taxAmount = parseFloat(((merged.amount * merged.taxRate) / 100).toFixed(2));
          merged.netReceived = parseFloat((merged.amount - merged.taxAmount).toFixed(2));
        }
        return merged;
      })
    );
  }, [setInvoices]);

  const deleteInvoice = useCallback((id) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  }, [setInvoices]);

  const duplicateInvoice = useCallback((id) => {
    const target = invoices.find(inv => inv.id === id);
    if (!target) return;

    const nextNo = getNextInvoiceNumber();
    const duplicated = {
      ...target,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      invoiceNo: nextNo,
      status: "Pending",
      receivedOn: "",
      taxAmount: 0,
      netReceived: 0,
      raisedOn: new Date().toISOString().split("T")[0],
      invoicedMonth: getMonthName(new Date().toISOString().split("T")[0]),
      remarks: target.remarks ? `Copy of ${target.invoiceNo}: ${target.remarks}` : `Copy of ${target.invoiceNo}`
    };

    setInvoices(prev => [duplicated, ...prev]);
  }, [invoices, getNextInvoiceNumber, setInvoices]);

  const markInvoiceAsPaid = useCallback((id, { receivedOn, taxRate = 0, taxAmount = 0, netReceived, remarks }) => {
    setInvoices(prev =>
      prev.map(inv => {
        if (inv.id !== id) return inv;
        const amt = Number(inv.amount || 0);
        const finalTaxRate = Number(taxRate);
        const finalTaxAmount = Number(taxAmount || (amt * finalTaxRate) / 100);
        const finalNetReceived = netReceived !== undefined ? Number(netReceived) : amt - finalTaxAmount;

        let finalRemarks = remarks !== undefined ? remarks : inv.remarks;
        if (finalTaxRate > 0 && (!finalRemarks || !finalRemarks.includes(`${finalTaxRate}%`))) {
          const taxNote = `Received payment after ${finalTaxRate}% tax deduction`;
          finalRemarks = finalRemarks ? `${finalRemarks} | ${taxNote}` : taxNote;
        }

        return {
          ...inv,
          status: "Received",
          receivedOn: receivedOn || new Date().toISOString().split("T")[0],
          taxRate: finalTaxRate,
          taxAmount: parseFloat(finalTaxAmount.toFixed(2)),
          netReceived: parseFloat(finalNetReceived.toFixed(2)),
          remarks: finalRemarks
        };
      })
    );
  }, [setInvoices]);

  /* ------------------------------------------------------------ recovery ---
   * Everything the recovery card can offer the user. Each action reports what it
   * actually achieved so the UI can state a result rather than just "done".
   */

  /** Look for a usable second copy without changing anything yet. */
  const inspectRecoveryOptions = useCallback(async () => {
    const options = { mirror: null, salvage: null };

    const record = await mirrorRead(STORAGE_KEYS.WORKSPACES);
    if (record && isValidWorkspaces(record.value)) {
      const count = record.value.reduce((n, w) => n + (w.invoices ? w.invoices.length : 0), 0);
      options.mirror = { savedAt: record.savedAt, invoiceCount: count, value: record.value };
    }

    if (storageState.quarantineKey) {
      const raw = readQuarantined(storageState.quarantineKey);
      const salvaged = salvageInvoices(raw);
      if (salvaged.length) options.salvage = { invoiceCount: salvaged.length, invoices: salvaged };
    }

    return options;
  }, [storageState.quarantineKey]);

  /** Restore the IndexedDB copy and resume normal saving. */
  const restoreFromMirror = useCallback((value) => {
    if (!isValidWorkspaces(value)) return { ok: false, reason: "Backup copy was not usable" };
    setWorkspaces(value);
    setActiveWorkspaceId(value[0]?.id || "default");
    setStorageState({ status: "ok" });
    const count = value.reduce((n, w) => n + (w.invoices ? w.invoices.length : 0), 0);
    return { ok: true, invoiceCount: count };
  }, []);

  /** Rebuild a ledger from whatever records survived inside the damaged blob. */
  const restoreFromSalvage = useCallback((invoices) => {
    if (!Array.isArray(invoices) || !invoices.length) {
      return { ok: false, reason: "No readable invoices were found" };
    }
    setWorkspaces([{
      id: "default",
      name: "Master Ledger (recovered)",
      invoices,
      createdAt: new Date().toISOString()
    }]);
    setActiveWorkspaceId("default");
    setStorageState({ status: "ok" });
    return { ok: true, invoiceCount: invoices.length };
  }, []);

  /** Give up on the damaged data and start clean. Deliberately explicit. */
  const discardAndStartFresh = useCallback(() => {
    if (storageState.quarantineKey) clearQuarantined(storageState.quarantineKey);
    setWorkspaces(freshWorkspace([]));
    setActiveWorkspaceId("default");
    setStorageState({ status: "ok" });
    return { ok: true };
  }, [storageState.quarantineKey]);

  /** Re-attempt a save that previously failed, e.g. after freeing space. */
  const retrySave = useCallback(() => {
    const result = safeWrite(STORAGE_KEYS.WORKSPACES, workspaces);
    if (result.ok) {
      setLastSavedAt(Date.now());
      setStorageState({ status: "ok" });
      mirrorWrite(STORAGE_KEYS.WORKSPACES, workspaces);
      return { ok: true };
    }
    setStorageState({
      status: "save-failed",
      kind: result.kind,
      detail: result.error ? result.error.message : "Unknown storage error",
      attemptedBytes: result.bytes || 0,
      usageBytes: estimateUsage()
    });
    return { ok: false, kind: result.kind };
  }, [workspaces]);

  /* ---------------------------------------------------------- DB backups --- */

  const createBackup = useCallback(async (reason = "manual") => {
    const res = await makeBackup(reason);
    if (res.ok) setLastBackupAt(Date.now());
    return res;
  }, []);

  const getBackups = useCallback(() => listBackups(), []);

  /** Restore a database snapshot and re-seed state from what actually landed. */
  const restoreDatabaseBackup = useCallback(async (path) => {
    const res = await restoreBackupFile(path);
    if (!res.ok) return res;

    const data = res.data;
    setWorkspaces(data.workspaces);
    setClients(data.clients && data.clients.length ? data.clients : INITIAL_CLIENTS);
    setSettings({
      ...DEFAULT_SETTINGS,
      ...(data.settings || {}),
      exchangeRates: {
        ...DEFAULT_SETTINGS.exchangeRates,
        ...((data.settings && data.settings.exchangeRates) || {})
      }
    });
    const active = data.workspaces.find((w) => w.id === activeWorkspaceId) || data.workspaces[0];
    persistedRef.current = snapshotInvoices(active ? active.invoices : []);
    setStorageState({ status: "ok" });

    const count = data.workspaces.reduce((n, w) => n + (w.invoices ? w.invoices.length : 0), 0);
    return { ok: true, invoiceCount: count };
  }, [activeWorkspaceId]);

  /** The raw damaged bytes, so the user can keep a copy before deciding. */
  const getQuarantinedRaw = useCallback(
    () => (storageState.quarantineKey ? readQuarantined(storageState.quarantineKey) : ""),
    [storageState.quarantineKey]
  );

  const [lastBackupAt, setLastBackupAt] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });

  const markBackedUp = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, String(Date.now()));
    } catch {
      /* non-critical */
    }
    setLastBackupAt(Date.now());
  }, []);

  // Decorate once per ledger change. Status, aging and period were previously
  // recomputed inside the filter predicate, so every keystroke in the search box
  // re-derived them for every invoice in the ledger.
  const decoratedInvoices = useMemo(() => {
    return invoices.map(inv => {
      const aging = calculateAging(inv);
      const period = getPeriod(inv);
      return {
        ...inv,
        _status: getEffectiveStatus(inv),
        _aging: aging,
        _bucket: getAgingBucket(inv),
        _hasTax: hasTaxDeduction(inv),
        _year: period.year,
        _month: period.month,
        _amount: Number(inv.amount || 0)
      };
    });
  }, [invoices]);

  const availableYears = useMemo(() => getAvailableYears(invoices), [invoices]);

  const availableCurrencies = useMemo(() => getUsedCurrencies(invoices), [invoices]);

  /**
   * Currencies in the ledger with no exchange rate configured. These convert 1:1
   * with the US dollar, which silently overstates them - a rand invoice counted as
   * dollars is out by a factor of eighteen. Surfaced so it can be corrected.
   */
  const unratedCurrencies = useMemo(() => {
    const rates = settings?.exchangeRates || {};
    return availableCurrencies
      .filter((code) => code && !rates[code])
      .map((code) => {
        const affected = invoices.filter((i) => (i.currency || "") === code);
        return {
          code,
          count: affected.length,
          faceValue: affected.reduce((sum, i) => sum + Number(i.amount || 0), 0)
        };
      })
      .sort((a, b) => b.faceValue - a.faceValue);
  }, [availableCurrencies, settings, invoices]);

  const availableClients = useMemo(() => {
    const names = new Set();
    invoices.forEach(i => { if (i.clientName) names.add(i.clientName); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const availablePaymentModes = useMemo(() => {
    const modes = new Set();
    invoices.forEach(i => { if (i.paymentMode) modes.add(i.paymentMode); });
    return Array.from(modes).sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    const min = amountMin === "" ? null : Number(amountMin);
    const max = amountMax === "" ? null : Number(amountMax);

    return decoratedInvoices
      .filter(inv => {
        // Text Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesNo = (inv.invoiceNo || "").toLowerCase().includes(q);
          const matchesClient = (inv.clientName || "").toLowerCase().includes(q);
          const matchesRemarks = (inv.remarks || "").toLowerCase().includes(q);
          const matchesAmount = String(inv.amount || "").includes(q);
          if (!matchesNo && !matchesClient && !matchesRemarks && !matchesAmount) {
            return false;
          }
        }

        // Status filter, driven by the shared effective status so that Cancelled and
        // Draft are reachable and never leak into Outstanding.
        if (statusFilter !== "all") {
          if (statusFilter === "Outstanding") {
            if (!isReceivable(inv)) return false;
          } else if (statusFilter === "TaxDeducted") {
            if (!inv._hasTax) return false;
          } else if (inv._status !== statusFilter) {
            return false;
          }
        }

        // Currency Filter
        if (currencyFilter !== "all" && inv.currency !== currencyFilter) {
          return false;
        }

        // Month and year are independent, so "January" can mean one January rather
        // than every January in the ledger.
        if (monthFilter !== "all" && inv._month !== monthFilter) return false;
        if (yearFilter !== "all" && String(inv._year) !== String(yearFilter)) return false;

        // Client Filter
        if (clientFilter !== "all" && inv.clientName !== clientFilter) return false;

        // Invoice number column filter
        if (invoiceNoFilter.trim()) {
          const q = invoiceNoFilter.trim().toLowerCase();
          if (!String(inv.invoiceNo || "").toLowerCase().includes(q)) return false;
        }

        // Payment mode
        if (paymentModeFilter !== "all" && (inv.paymentMode || "") !== paymentModeFilter) return false;

        // Aging bucket
        if (agingFilter !== "all" && inv._bucket !== agingFilter) return false;

        // Tax / TDS
        if (taxFilter === "with" && !inv._hasTax) return false;
        if (taxFilter === "without" && inv._hasTax) return false;

        // Settlement date presence
        if (settledFilter === "settled" && !inv.receivedOn) return false;
        if (settledFilter === "unsettled" && inv.receivedOn) return false;

        // Amount range, compared on the invoice's own currency amount
        if (min !== null && !isNaN(min) && inv._amount < min) return false;
        if (max !== null && !isNaN(max) && inv._amount > max) return false;

        return true;
      })
      .sort((a, b) => {
        let valA = sortField === "status" ? a._status : a[sortField];
        let valB = sortField === "status" ? b._status : b[sortField];

        if (sortField === "amount") {
          valA = Number(valA || 0);
          valB = Number(valB || 0);
        } else if (sortField === "raisedOn" || sortField === "receivedOn" || sortField === "dueDate") {
          valA = new Date(valA || 0).getTime();
          valB = new Date(valB || 0).getTime();
        } else {
          valA = (valA || "").toString().toLowerCase();
          valB = (valB || "").toString().toLowerCase();
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    decoratedInvoices, searchQuery, statusFilter, currencyFilter, monthFilter, yearFilter,
    clientFilter, invoiceNoFilter, paymentModeFilter, agingFilter, taxFilter, settledFilter,
    amountMin, amountMax, sortField, sortDirection
  ]);

  return {
    isLoading,
    isDesktop: isDesktop(),
    backend: backendName(),
    dbInfo,
    migrationReport,
    dismissMigrationReport: () => setMigrationReport(null),
    createBackup,
    getBackups,
    restoreDatabaseBackup,
    revealBackups,
    ledgerStats,
    invoices,
    filteredInvoices,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    clients,
    settings,
    baseCurrency,
    theme,
    searchQuery,
    statusFilter,
    currencyFilter,
    monthFilter,
    yearFilter,
    clientFilter,
    invoiceNoFilter,
    paymentModeFilter,
    agingFilter,
    taxFilter,
    settledFilter,
    amountMin,
    amountMax,
    availableYears,
    availableCurrencies,
    unratedCurrencies,
    availableClients,
    availablePaymentModes,
    storageState,
    lastSavedAt,
    lastBackupAt,
    markBackedUp,
    inspectRecoveryOptions,
    restoreFromMirror,
    restoreFromSalvage,
    discardAndStartFresh,
    retrySave,
    getQuarantinedRaw,
    sortField,
    sortDirection,
    setSearchQuery,
    setStatusFilter,
    setCurrencyFilter,
    setMonthFilter,
    setYearFilter,
    setClientFilter,
    setInvoiceNoFilter,
    setPaymentModeFilter,
    setAgingFilter,
    setTaxFilter,
    setSettledFilter,
    setAmountMin,
    setAmountMax,
    resetFilters,
    setSortField,
    setSortDirection,
    setBaseCurrency,
    setSettings,
    toggleTheme,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    duplicateInvoice,
    markInvoiceAsPaid,
    importInvoices,
    resetToSampleData,
    clearCurrentLedger,
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    renameWorkspace,
    getNextInvoiceNumber,
    setClients
  };
}
