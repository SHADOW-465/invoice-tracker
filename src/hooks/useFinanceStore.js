// State Management & LocalStorage Persistence Hook
import { useState, useEffect, useCallback, useMemo } from "react";
import { INITIAL_INVOICES, INITIAL_CLIENTS } from "../types/finance";
import { getMonthName, calculateDueDate, calculateAging } from "../utils/calculations";

const STORAGE_KEYS = {
  INVOICES: "apex_finance_invoices_v1",
  WORKSPACES: "apex_finance_workspaces_v1",
  ACTIVE_WORKSPACE: "apex_finance_active_workspace_v1",
  CLIENTS: "apex_finance_clients_v1",
  SETTINGS: "apex_finance_settings_v1",
  THEME: "apex_finance_theme_v1",
  BASE_CURRENCY: "apex_finance_base_currency_v1"
};

const DEFAULT_SETTINGS = {
  companyName: "Simon & Son Global",
  companyEmail: "accounts@simonandson.com",
  companyAddress: "Navalur, OMR Road, Chennai, Tamil Nadu 600130",
  taxId: "IN-33AAACS1234F1Z5",
  invoicePrefix: "SnS",
  defaultPaymentTerms: "Net 30",
  defaultCurrency: "USD",
  bankDetails: "HDFC Bank\nAccount: 5020-0012-3456-78\nIFSC: HDFC0001234\nBranch: Navalur, Chennai"
};

export function useFinanceStore() {
  // 1. Workspaces state (Multi-Ledger Support)
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORKSPACES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Migrate legacy invoices if present
      const legacySaved = localStorage.getItem(STORAGE_KEYS.INVOICES);
      const initialInv = legacySaved ? JSON.parse(legacySaved) : INITIAL_INVOICES;
      return [
        {
          id: "default",
          name: "Master Ledger",
          invoices: initialInv,
          createdAt: new Date().toISOString()
        }
      ];
    } catch (e) {
      return [
        {
          id: "default",
          name: "Master Ledger",
          invoices: INITIAL_INVOICES,
          createdAt: new Date().toISOString()
        }
      ];
    }
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE) || "default";
    } catch (e) {
      return "default";
    }
  });

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
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
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
  const [clientFilter, setClientFilter] = useState("all");
  const [sortField, setSortField] = useState("raisedOn");
  const [sortDirection, setSortDirection] = useState("desc");

  // Persist workspaces to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(workspaces));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, activeWorkspaceId);
      // Keep legacy key in sync for backward compatibility
      if (activeWorkspace) {
        localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(activeWorkspace.invoices || []));
      }
    } catch (e) {
      console.error("Failed to persist workspaces", e);
    }
  }, [workspaces, activeWorkspaceId, activeWorkspace]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    } catch (e) {
      console.error("Failed to persist clients", e);
    }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to persist settings", e);
    }
  }, [settings]);

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
    setWorkspaces(prev => {
      if (prev.length <= 1) {
        return [{ id: "default", name: "Master Ledger", invoices: [], createdAt: new Date().toISOString() }];
      }
      return prev.filter(w => w.id !== id);
    });
    setActiveWorkspaceId(prevId => {
      if (prevId === id) {
        const remaining = workspaces.filter(w => w.id !== id);
        return remaining[0]?.id || "default";
      }
      return prevId;
    });
  }, [workspaces]);

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
  }, [createWorkspace, setInvoices]);

  // Helper to suggest next invoice number
  const getNextInvoiceNumber = useCallback(() => {
    const prefix = settings.invoicePrefix || "SnS";
    let maxNum = 2534;

    invoices.forEach(inv => {
      if (inv.invoiceNo) {
        const match = inv.invoiceNo.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const nextVal = maxNum + 1;
    const padded = String(nextVal).padStart(5, "0");
    return `${prefix}${padded}`;
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

  // Filtered & Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return invoices
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

        // Status Filter
        if (statusFilter !== "all") {
          const aging = calculateAging(inv);
          if (statusFilter === "Overdue") {
            if (!aging.isOverdue || inv.status === "Received") return false;
          } else if (statusFilter === "Pending") {
            if (inv.status !== "Pending" || aging.isOverdue) return false;
          } else if (statusFilter === "Outstanding") {
            if (inv.status === "Received") return false;
          } else if (statusFilter === "TaxDeducted") {
            const hasTax = Number(inv.taxAmount || 0) > 0 || (inv.remarks && inv.remarks.toLowerCase().includes("tax"));
            if (!hasTax) return false;
          } else {
            if (inv.status !== statusFilter) return false;
          }
        }

        // Currency Filter
        if (currencyFilter !== "all" && inv.currency !== currencyFilter) {
          return false;
        }

        // Month Filter
        if (monthFilter !== "all") {
          const m = inv.invoicedMonth || (inv.raisedOn ? getMonthName(inv.raisedOn) : "");
          if (m !== monthFilter) return false;
        }

        // Client Filter
        if (clientFilter !== "all" && inv.clientName !== clientFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

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
  }, [invoices, searchQuery, statusFilter, currencyFilter, monthFilter, clientFilter, sortField, sortDirection]);

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
    clientFilter,
    sortField,
    sortDirection,
    setSearchQuery,
    setStatusFilter,
    setCurrencyFilter,
    setMonthFilter,
    setClientFilter,
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
