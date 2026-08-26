// State Management & LocalStorage Persistence Hook
import { useState, useEffect, useCallback, useMemo } from "react";
import { INITIAL_INVOICES, INITIAL_CLIENTS } from "../types/finance";
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
import {
  cloneInvoice,
  cloneInvoices,
  invoicesEquivalent,
  makeHistoryEvent,
  summariseCreated,
  summariseUpdated,
  summarisePaid,
  summarisePartial,
  summariseDuplicated,
  summariseDeleted,
  summariseImported,
  actionForFieldUpdate,
  pruneEvents,
  HISTORY_CAP
} from "../utils/changeHistory";
import { loadLocalChangeEvents, persistChangeEvents, loadChangeEvents, persistChangeEventUndone } from "../utils/ledgerStore";

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
    PESO: 0.0495,
    CAD: 0.74,
    AUD: 0.66,
    SGD: 0.75,
    JPY: 0.0067,
    CNY: 0.14
  }
};

const freshWorkspace = (invoices = INITIAL_INVOICES) => ([
  { id: "default", name: "Master Ledger", invoices, createdAt: new Date().toISOString() }
]);

/**
 * Load the ledger without ever destroying what is already on disk.
 *
 * A damaged read used to fall through to the bundled sample invoices, which the
 * persist effect then wrote straight over the damaged original - turning a
 * recoverable problem into permanent, silent data loss. Now a damaged read puts
 * the app into recovery mode and every write is blocked until the user decides.
 */
function hydrateWorkspaces() {
  const read = safeRead(STORAGE_KEYS.WORKSPACES, isValidWorkspaces);

  if (read.status === "ok") {
    return { workspaces: read.value, storage: { status: "ok" } };
  }

  if (read.status === "corrupt") {
    const quarantineKey = quarantine(STORAGE_KEYS.WORKSPACES, read.raw);
    return {
      // Show an empty ledger, never sample data - sample data in a real business
      // ledger reads as "my invoices turned into someone else's".
      workspaces: freshWorkspace([]),
      storage: {
        status: "corrupt",
        quarantineKey,
        rawBytes: read.raw ? read.raw.length : 0,
        detail: read.error ? read.error.message : "Saved data could not be read"
      }
    };
  }

  if (read.status === "unavailable") {
    return {
      workspaces: freshWorkspace([]),
      storage: {
        status: "unavailable",
        detail: read.error ? read.error.message : "Local storage is not accessible"
      }
    };
  }

  // Nothing stored yet: first run, or a legacy single-ledger install to migrate.
  const legacy = safeRead(STORAGE_KEYS.INVOICES);
  if (legacy.status === "ok" && Array.isArray(legacy.value) && legacy.value.length) {
    return { workspaces: freshWorkspace(legacy.value), storage: { status: "ok" } };
  }
  if (legacy.status === "corrupt") {
    const quarantineKey = quarantine(STORAGE_KEYS.INVOICES, legacy.raw);
    return {
      workspaces: freshWorkspace([]),
      storage: {
        status: "corrupt",
        quarantineKey,
        rawBytes: legacy.raw ? legacy.raw.length : 0,
        detail: "Saved data from an earlier version could not be read"
      }
    };
  }

  return { workspaces: freshWorkspace(INITIAL_INVOICES), storage: { status: "ok" } };
}

export function useFinanceStore() {
  // Hydrate once, capturing both the data and how healthy storage was.
  const [initial] = useState(hydrateWorkspaces);

  // 1. Workspaces state (Multi-Ledger Support)
  const [workspaces, setWorkspaces] = useState(initial.workspaces);
  const [storageState, setStorageState] = useState(initial.storage);

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
  const [clients, setClients] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
    } catch (e) {
      return INITIAL_CLIENTS;
    }
  });

  // 3. Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!saved) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(saved);
      // Merge rates key-by-key so a settings blob saved before a currency existed
      // does not drop that currency's rate to undefined.
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        exchangeRates: { ...DEFAULT_SETTINGS.exchangeRates, ...(parsed.exchangeRates || {}) }
      };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

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
  const [changeEvents, setChangeEvents] = useState(loadLocalChangeEvents);

  const recordEvent = useCallback((event) => {
    if (writesBlocked) return;
    setChangeEvents((prev) => pruneEvents([event, ...prev], event.workspaceId, HISTORY_CAP));
  }, [writesBlocked]);

  // Persist workspaces.
  //
  // The legacy mirror of the active ledger used to be written here as well, which
  // doubled storage for no benefit. Every write now goes through safeWrite, which
  // reports failures as data instead of throwing them at the console.
  useEffect(() => {
    if (writesBlocked) return;

    const result = safeWrite(STORAGE_KEYS.WORKSPACES, workspaces);

    if (result.ok) {
      try {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, activeWorkspaceId);
        // The legacy key is read once at first load to migrate old installs. Once
        // workspaces exist it is dead weight, so drop it rather than mirroring it.
        if (localStorage.getItem(STORAGE_KEYS.INVOICES)) {
          localStorage.removeItem(STORAGE_KEYS.INVOICES);
        }
      } catch {
        /* the ledger itself saved, which is what matters */
      }
      setLastSavedAt(Date.now());
      setStorageState((prev) => (prev.status === "ok" ? prev : { status: "ok" }));
      // Second copy in IndexedDB - a much larger quota, failing independently.
      mirrorWrite(STORAGE_KEYS.WORKSPACES, workspaces);
      return;
    }

    console.error("Failed to persist workspaces", result.error);
    // A failure while SAVING must never block the app. The data is still in memory
    // and the only useful thing the user can do is export it - which requires the
    // interface to stay reachable.
    setStorageState({
      status: "save-failed",
      kind: result.kind,
      detail: result.error ? result.error.message : "Unknown storage error",
      attemptedBytes: result.bytes || 0,
      usageBytes: estimateUsage()
    });
    // The primary write failed, so the mirror is now the only fresh copy. This is
    // exactly when it earns its keep.
    mirrorWrite(STORAGE_KEYS.WORKSPACES, workspaces);
  }, [workspaces, activeWorkspaceId, writesBlocked]);

  useEffect(() => {
    if (writesBlocked) return;
    persistChangeEvents(changeEvents);
  }, [changeEvents, writesBlocked]);

  useEffect(() => {
    let cancelled = false;
    loadChangeEvents().then((rows) => {
      if (cancelled || !Array.isArray(rows) || !rows.length) return;
      setChangeEvents((prev) => {
        const map = new Map();
        [...rows, ...prev].forEach((e) => {
          if (e?.id && !map.has(e.id)) map.set(e.id, e);
        });
        return Array.from(map.values()).sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (writesBlocked) return;
    safeWrite(STORAGE_KEYS.CLIENTS, clients);
  }, [clients, writesBlocked]);

  useEffect(() => {
    if (writesBlocked) return;
    safeWrite(STORAGE_KEYS.SETTINGS, settings);
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

  /**
   * Fill in client contact details discovered during an Excel import.
   *
   * Only ever fills a BLANK field - a contact name or email already on file (set
   * by hand, or from an earlier, more complete import) is never overwritten by a
   * later row that happens to have it empty.
   */
  const mergeClientContacts = useCallback((discovered = []) => {
    if (!discovered.length) return;
    setClients(prev => {
      const byName = new Map(prev.map(c => [String(c.name || "").trim().toLowerCase(), c]));
      let changed = false;

      discovered.forEach(d => {
        const key = String(d.name || "").trim().toLowerCase();
        if (!key) return;
        const existing = byName.get(key);
        if (!existing) {
          byName.set(key, {
            id: `c-${Date.now()}-${key.replace(/\s+/g, "_")}`,
            name: d.name.trim(),
            contactPerson: d.contactPerson || "",
            email: d.email || "",
            defaultCurrency: d.defaultCurrency || "USD",
            defaultTerms: "Net 30",
            notes: "Discovered from import"
          });
          changed = true;
          return;
        }
        const patch = {};
        if (d.contactPerson && !existing.contactPerson) patch.contactPerson = d.contactPerson;
        if (d.email && !existing.email) patch.email = d.email;
        if (Object.keys(patch).length) {
          byName.set(key, { ...existing, ...patch });
          changed = true;
        }
      });

      return changed ? Array.from(byName.values()) : prev;
    });
  }, [setClients]);

  const importInvoices = useCallback((newInvoices, mode = "merge", workspaceName = null, discoveredClients = [], meta = {}) => {
    mergeClientContacts(discoveredClients);
    const snapshot = cloneInvoices(invoices);
    const count = Array.isArray(newInvoices) ? newInvoices.length : 0;
    const summary = summariseImported({
      count,
      mode,
      fileName: meta.fileName || ""
    });

    if (mode === "new_workspace") {
      const name = workspaceName || `Ledger (${new Date().toLocaleDateString()})`;
      const newId = createWorkspace(name, newInvoices);
      recordEvent(makeHistoryEvent({
        action: "imported",
        workspaceId: newId,
        before: [],
        after: { count, mode, fileName: meta.fileName || "" },
        summary,
        extra: { invoiceId: null, invoiceNo: "", clientName: "" }
      }));
    } else if (mode === "replace") {
      setInvoices(newInvoices);
      recordEvent(makeHistoryEvent({
        action: "imported",
        workspaceId: activeWorkspaceId,
        before: snapshot,
        after: { count, mode, fileName: meta.fileName || "" },
        summary,
        extra: { invoiceId: null, invoiceNo: "", clientName: "" }
      }));
    } else {
      setInvoices((prev) => {
        const existingMap = new Map(prev.map((i) => [i.invoiceNo.toLowerCase(), i]));
        newInvoices.forEach((newItem) => {
          existingMap.set(newItem.invoiceNo.toLowerCase(), newItem);
        });
        return Array.from(existingMap.values());
      });
      recordEvent(makeHistoryEvent({
        action: "imported",
        workspaceId: activeWorkspaceId,
        before: snapshot,
        after: { count, mode, fileName: meta.fileName || "" },
        summary,
        extra: { invoiceId: null, invoiceNo: "", clientName: "" }
      }));
    }
  }, [createWorkspace, setInvoices, mergeClientContacts, invoices, recordEvent, activeWorkspaceId]);

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
    recordEvent(makeHistoryEvent({
      action: "created",
      workspaceId: activeWorkspaceId,
      invoice: newInvoice,
      after: cloneInvoice(newInvoice),
      summary: summariseCreated(newInvoice)
    }));

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
              contactPerson: "",
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
  }, [getNextInvoiceNumber, settings.defaultCurrency, setInvoices, recordEvent, activeWorkspaceId]);

  const updateInvoice = useCallback((id, updatedFields) => {
    let before = null;
    let after = null;
    setInvoices((prev) => {
      before = prev.find((inv) => inv.id === id) || null;
      return prev.map((inv) => {
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
          if (updatedFields.taxAmount === undefined) {
            merged.taxAmount = parseFloat(((merged.amount * merged.taxRate) / 100).toFixed(2));
          }
          // Never invent a full settlement over a recorded partial (or an
          // explicit netReceived the caller already computed).
          if (updatedFields.netReceived === undefined && merged.status === "Received") {
            merged.netReceived = parseFloat((merged.amount - merged.taxAmount).toFixed(2));
          }
        }
        after = merged;
        return merged;
      });
    });
    if (before && after) {
      const action = actionForFieldUpdate(before, after);
      const summary =
        action === "paid"
          ? summarisePaid(after)
          : action === "partial"
          ? summarisePartial(after)
          : summariseUpdated(before, after);
      recordEvent(makeHistoryEvent({
        action,
        workspaceId: activeWorkspaceId,
        before: cloneInvoice(before),
        after: cloneInvoice(after),
        summary
      }));
    }
  }, [setInvoices, recordEvent, activeWorkspaceId]);

  const deleteInvoice = useCallback((id) => {
    let removed = null;
    setInvoices((prev) => {
      removed = prev.find((inv) => inv.id === id) || null;
      return prev.filter((inv) => inv.id !== id);
    });
    if (removed) {
      recordEvent(makeHistoryEvent({
        action: "deleted",
        workspaceId: activeWorkspaceId,
        invoice: removed,
        before: cloneInvoice(removed),
        after: null,
        summary: summariseDeleted(removed)
      }));
    }
  }, [setInvoices, recordEvent, activeWorkspaceId]);

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
    recordEvent(makeHistoryEvent({
      action: "duplicated",
      workspaceId: activeWorkspaceId,
      invoice: duplicated,
      before: cloneInvoice(target),
      after: cloneInvoice(duplicated),
      summary: summariseDuplicated(target, duplicated)
    }));
  }, [invoices, getNextInvoiceNumber, setInvoices, recordEvent, activeWorkspaceId]);

  const markInvoiceAsPaid = useCallback((id, { receivedOn, taxRate = 0, taxAmount = 0, netReceived, status, remarks }) => {
    // The caller (MarkPaidModal) has already decided whether this is a full
    // settlement or a partial payment and has already composed the remarks text
    // for it - this used to also auto-append a tax note here, which meant a
    // partial payment's remarks could be silently overwritten with a "received
    // after tax deduction" note that did not apply to it. Trust what was passed.
    let before = null;
    let after = null;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        before = inv;
        const amt = Number(inv.amount || 0);
        const finalTaxRate = Number(taxRate);
        const finalTaxAmount = Number(taxAmount || (amt * finalTaxRate) / 100);
        const finalNetReceived = netReceived !== undefined ? Number(netReceived) : amt - finalTaxAmount;

        after = {
          ...inv,
          status: status || "Received",
          receivedOn: receivedOn || new Date().toISOString().split("T")[0],
          taxRate: finalTaxRate,
          taxAmount: parseFloat(finalTaxAmount.toFixed(2)),
          netReceived: parseFloat(finalNetReceived.toFixed(2)),
          remarks: remarks !== undefined ? remarks : inv.remarks
        };
        return after;
      })
    );
    if (before && after) {
      const action = after.status === "Partially Paid" ? "partial" : "paid";
      recordEvent(makeHistoryEvent({
        action,
        workspaceId: activeWorkspaceId,
        before: cloneInvoice(before),
        after: cloneInvoice(after),
        summary: action === "partial" ? summarisePartial(after) : summarisePaid(after)
      }));
    }
  }, [setInvoices, recordEvent, activeWorkspaceId]);

  const markEventUndone = useCallback((eventId) => {
    setChangeEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, undone: true, undoneAt: new Date().toISOString() } : e))
    );
    persistChangeEventUndone(eventId, true);
  }, []);

  const undoHistoryEvent = useCallback((eventId, { force = false } = {}) => {
    if (writesBlocked) {
      return { ok: false, reason: "Saving is paused until storage is recovered" };
    }
    const event = changeEvents.find((e) => e.id === eventId);
    if (!event) return { ok: false, reason: "That history row is gone" };
    if (event.action === "restored") {
      return { ok: false, reason: "That row is an old undo record and is no longer used" };
    }
    if (event.undone) {
      return { ok: false, reason: "This change is already undone" };
    }
    if (event.workspaceId && event.workspaceId !== activeWorkspaceId) {
      return { ok: false, reason: "Switch to that ledger first" };
    }

    if (event.action === "imported") {
      if (!Array.isArray(event.before)) {
        return {
          ok: false,
          undoable: false,
          reason: "This import cannot be undone — the previous ledger was not saved with it"
        };
      }
      setInvoices(cloneInvoices(event.before));
      markEventUndone(eventId);
      return { ok: true };
    }

    const live = invoices.find((i) => i.id === event.invoiceId);

    if (event.action === "created" || event.action === "duplicated") {
      if (live && event.after && !force && !invoicesEquivalent(live, event.after)) {
        return { ok: false, stale: true, live };
      }
      if (live) setInvoices((prev) => prev.filter((i) => i.id !== event.invoiceId));
      markEventUndone(eventId);
      return { ok: true };
    }

    if (event.action === "deleted") {
      if (!event.before) {
        return { ok: false, undoable: false, reason: "Nothing to restore" };
      }
      if (live) {
        return { ok: false, reason: "That invoice is already on the ledger" };
      }
      const clash = invoices.find(
        (i) =>
          String(i.invoiceNo || "").trim().toLowerCase() ===
          String(event.before.invoiceNo || "").trim().toLowerCase()
      );
      if (clash) {
        return {
          ok: false,
          reason: `Invoice number ${event.before.invoiceNo} is already used by ${clash.clientName || "another record"}`
        };
      }
      setInvoices((prev) => [cloneInvoice(event.before), ...prev]);
      markEventUndone(eventId);
      return { ok: true };
    }

    if (!event.before) {
      return { ok: false, undoable: false, reason: "Nothing to restore" };
    }
    if (!live) {
      return { ok: false, reason: "That invoice is no longer on the ledger" };
    }
    if (!force && event.after && !invoicesEquivalent(live, event.after)) {
      return { ok: false, stale: true, live };
    }
    setInvoices((prev) => prev.map((i) => (i.id === live.id ? cloneInvoice(event.before) : i)));
    markEventUndone(eventId);
    return { ok: true };
  }, [
    writesBlocked,
    changeEvents,
    activeWorkspaceId,
    invoices,
    setInvoices,
    markEventUndone
  ]);

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
    historyEvents: changeEvents.filter(
      (e) => e.workspaceId === activeWorkspaceId && e.action !== "restored"
    ),
    undoHistoryEvent,
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
