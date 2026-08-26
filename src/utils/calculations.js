// Financial Calculation & Data Aggregation Utilities
import { CURRENCIES } from "../types/finance";

/** Fallback rates, derived from the single currency table. */
const BASE_RATES = CURRENCIES.reduce((acc, c) => {
  acc[c.code] = c.rateToBase;
  return acc;
}, {});

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Format a date string (YYYY-MM-DD) into clean presentation format (e.g., Jan 12, 2026)
 */
export function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (e) {
    return dateString;
  }
}

/**
 * Return ISO string YYYY-MM-DD from Date or string
 */
export function toISODate(date) {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Derive Month name from a date string
 */
export function getMonthName(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return MONTH_NAMES[d.getMonth()];
}

/**
 * Calculate due date given raisedOn date and payment terms
 */
export function calculateDueDate(raisedOnStr, termDays = 30) {
  if (!raisedOnStr) return "";
  if (termDays === null || termDays === undefined) return raisedOnStr;
  const d = new Date(raisedOnStr);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Number(termDays));
  return toISODate(d);
}

/**
 * Statuses that take an invoice out of the receivables cycle entirely.
 * A cancelled or draft invoice can never be "overdue" - there is nothing to collect.
 */
// Statuses that void the document entirely - not revenue, never chased.
// "Duplicate" appears in the real ledger for records raised twice by mistake.
export const TERMINAL_STATUSES = ["Cancelled", "Draft", "Duplicate"];

// Still owed, but collection is deliberately paused. Must never age into Overdue,
// or 50 knowingly-parked invoices show up every day as though they need chasing.
export const ON_HOLD_STATUSES = ["Suspended"];
export const isOnHold = (status) => ON_HOLD_STATUSES.includes(status);
export const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

// Some of the cash landed, some did not. Unlike Suspended this keeps aging - the
// remaining balance can still go stale and needs chasing like any other
// receivable, it is just not the full invoiced amount anymore.
export const PARTIAL_STATUSES = ["Partially Paid"];
export const isPartiallyPaid = (status) => PARTIAL_STATUSES.includes(status);

/**
 * What is still owed on an invoice, in its own currency.
 *
 * For a full settlement this is (correctly) zero. For a partial payment it is the
 * gap between what was actually credited and the amount owed after any
 * withholding - the number the source spreadsheet kept in "Remaining Amount".
 */
export function getBalanceDue(invoice) {
  const amount = Number(invoice?.amount || 0);
  const tax = Number(invoice?.taxAmount || 0);
  const received = Number(invoice?.netReceived || 0);
  return Math.max(0, Math.round((amount - tax - received) * 100) / 100);
}

/**
 * THE single source of truth for what an invoice's status actually is right now.
 *
 * Every screen must call this instead of comparing dates itself. Three separate
 * inline implementations of "is it overdue" previously disagreed with each other,
 * which is why a cancelled invoice still displayed as Overdue and why the dashboard
 * overdue count did not match the ledger tab badge.
 *
 * Precedence: Received > Cancelled/Draft > explicit Overdue > date-derived.
 */
export function getEffectiveStatus(invoice) {
  const raw = invoice?.status || "Pending";
  if (raw === "Received") return "Received";
  // Terminal statuses are the user's explicit decision and never age.
  if (isTerminalStatus(raw)) return raw;
  // On-hold invoices are still receivable but are not overdue.
  if (isOnHold(raw)) return raw;
  // Partially paid keeps its own label rather than being overwritten to "Overdue" -
  // a user who already collected part of the invoice should not lose that context
  // the moment the due date passes. The balance still ages into the aging buckets
  // and overdue totals below; only the displayed label stays put.
  if (isPartiallyPaid(raw)) return "Partially Paid";
  // An explicit Overdue flag is respected even before the due date, otherwise an
  // invoice the user flagged by hand would vanish from every tab.
  if (raw === "Overdue") return "Overdue";
  return calculateAging(invoice).isOverdue ? "Overdue" : "Pending";
}

/** True when the invoice still represents money we expect to collect. */
export function isReceivable(invoice) {
  const eff = getEffectiveStatus(invoice);
  return eff === "Pending" || eff === "Overdue" || isOnHold(eff) || isPartiallyPaid(eff);
}

/**
 * Calculate aging days and overdue status
 * Returns { daysOutstanding, daysToCollect, isOverdue, overdueDays, effectiveStatus }
 */
export function calculateAging(invoice) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const raisedDate = invoice.raisedOn ? new Date(invoice.raisedOn) : null;
  if (raisedDate) raisedDate.setHours(0, 0, 0, 0);

  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : (raisedDate ? new Date(raisedDate.getTime() + 30 * 86400000) : null);
  if (dueDate) dueDate.setHours(0, 0, 0, 0);

  const receivedDate = invoice.receivedOn ? new Date(invoice.receivedOn) : null;
  if (receivedDate) receivedDate.setHours(0, 0, 0, 0);

  let daysOutstanding = 0;
  let daysToCollect = null;
  let isOverdue = false;
  let overdueDays = 0;
  let effectiveStatus = invoice.status || "Pending";

  if (invoice.status === "Received") {
    if (raisedDate && receivedDate) {
      const diffMs = receivedDate.getTime() - raisedDate.getTime();
      daysToCollect = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
  } else if (!isTerminalStatus(invoice.status) && !isOnHold(invoice.status)) {
    if (raisedDate) {
      const diffMs = today.getTime() - raisedDate.getTime();
      daysOutstanding = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
    if (dueDate && today > dueDate) {
      isOverdue = true;
      const overdueMs = today.getTime() - dueDate.getTime();
      overdueDays = Math.max(1, Math.round(overdueMs / (1000 * 60 * 60 * 24)));
      effectiveStatus = "Overdue";
    } else if (invoice.status === "Overdue") {
      // Flagged overdue by hand before the due date - respect it, but report 0 days
      // past due rather than inventing a number.
      isOverdue = true;
      effectiveStatus = "Overdue";
    }
  }

  return {
    daysOutstanding,
    daysToCollect,
    isOverdue,
    overdueDays,
    effectiveStatus
  };
}

/**
 * Currency conversion to base currency
 */
export function convertToBaseCurrency(amount, currencyCode, baseCurrencyCode = "USD", rates = {}) {
  if (!amount || isNaN(amount)) return 0;
  const num = Number(amount);
  if (currencyCode === baseCurrencyCode) return num;

  // Built from the currency table itself rather than a second hard-coded copy.
  // The duplicate list is exactly how ZAR, NZD and MXN ended up converting 1:1
  // with the dollar after being added to CURRENCIES.
  const defaultRates = { ...BASE_RATES, ...rates };

  // An unknown currency previously fell back to 1.0, silently treating e.g. one
  // dirham as one dollar and overstating that invoice by nearly 4x. Warn loudly in
  // development so a missing rate is fixed rather than quietly mispriced.
  if (defaultRates[currencyCode] === undefined && typeof console !== "undefined") {
    if (!convertToBaseCurrency._warned) convertToBaseCurrency._warned = new Set();
    if (!convertToBaseCurrency._warned.has(currencyCode)) {
      convertToBaseCurrency._warned.add(currencyCode);
      console.warn(
        `[FinanceOS] No exchange rate configured for "${currencyCode}". ` +
        `Treating it as 1:1 with USD. Set a rate in Settings to correct every total.`
      );
    }
  }

  const fromRateInUSD = defaultRates[currencyCode] ?? 1.0;
  const toRateInUSD = defaultRates[baseCurrencyCode] ?? 1.0;

  // Convert to USD first, then to target base currency
  const inUSD = num * fromRateInUSD;
  return inUSD / toRateInUSD;
}

/**
 * Format currency amount with symbol
 */
export function formatCurrency(amount, currencyCode = "USD", includeCode = false) {
  if (amount === undefined || amount === null || isNaN(amount)) return "—";
  const num = Number(amount);
  const found = CURRENCIES.find(c => c.code === currencyCode);
  const symbol = found ? found.symbol : `${currencyCode} `;

  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return includeCode ? `${currencyCode} ${formatted}` : `${symbol}${formatted}`;
}

/**
 * Aggregate summary metrics across all invoices
 */
export function calculateFinancialMetrics(invoices, baseCurrency = "USD", rates = {}) {
  let totalInvoicedBase = 0;
  let totalReceivedBase = 0;
  let totalPendingBase = 0;
  let totalOverdueBase = 0;
  let totalTaxWithheldBase = 0;
  let totalVoidedBase = 0;
  let voidedCount = 0;

  const currencyBreakdown = {};
  const monthlyData = {};
  const agingBuckets = {
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    days90Plus: 0
  };

  let totalCollectionDays = 0;
  let receivedCount = 0;

  invoices.forEach(inv => {
    const rawAmt = Number(inv.amount || 0);
    const curr = inv.currency || "USD";
    const baseAmt = convertToBaseCurrency(rawAmt, curr, baseCurrency, rates);
    const aging = calculateAging(inv);

    // A cancelled or draft invoice is not revenue. Counting it as "invoiced" inflated
    // the denominator and quietly depressed the collection rate.
    if (isTerminalStatus(inv.status)) {
      totalVoidedBase += baseAmt;
      voidedCount += 1;
      return;
    }

    // Currency stats
    if (!currencyBreakdown[curr]) {
      currencyBreakdown[curr] = { total: 0, received: 0, pending: 0, count: 0 };
    }
    currencyBreakdown[curr].total += rawAmt;
    currencyBreakdown[curr].count += 1;

    // Billed amount is attributed to the invoice date. Collected cash is
    // attributed to the payment date. Putting both on the raised-on month made
    // "collected in August" look identical to "invoiced in April and paid later",
    // which is why the chart read as invoice activity rather than cash.
    const billedPeriod = getPeriod(inv);
    const billedBucket = ensureMonthBucket(monthlyData, billedPeriod);
    billedBucket.invoiced += baseAmt;
    billedBucket.count += 1;

    totalInvoicedBase += baseAmt;

    if (inv.status === "Received") {
      const netBase = convertToBaseCurrency(Number(inv.netReceived || rawAmt), curr, baseCurrency, rates);
      const taxBase = convertToBaseCurrency(Number(inv.taxAmount || 0), curr, baseCurrency, rates);
      totalReceivedBase += netBase;
      totalTaxWithheldBase += taxBase;
      currencyBreakdown[curr].received += rawAmt;
      const cashPeriod = getPeriod({ raisedOn: inv.receivedOn || inv.raisedOn });
      ensureMonthBucket(monthlyData, cashPeriod).received += netBase;

      if (aging.daysToCollect !== null) {
        totalCollectionDays += aging.daysToCollect;
        receivedCount += 1;
      }
    } else if (isPartiallyPaid(inv.status)) {
      // Split the invoice: the part that already landed counts as collected, only
      // the remaining balance counts as outstanding. Counting the full invoiced
      // amount as "pending" here as well (as every other receivable status does)
      // would double-count the cash that was already received.
      const receivedSoFar = Number(inv.netReceived || 0);
      const taxBase = convertToBaseCurrency(Number(inv.taxAmount || 0), curr, baseCurrency, rates);
      const receivedBase = convertToBaseCurrency(receivedSoFar, curr, baseCurrency, rates);
      totalReceivedBase += receivedBase;
      totalTaxWithheldBase += taxBase;
      currencyBreakdown[curr].received += receivedSoFar;
      const cashPeriod = getPeriod({ raisedOn: inv.receivedOn || inv.raisedOn });
      ensureMonthBucket(monthlyData, cashPeriod).received += receivedBase;

      const balance = getBalanceDue(inv);
      const balanceBase = convertToBaseCurrency(balance, curr, baseCurrency, rates);
      currencyBreakdown[curr].pending += balance;

      if (aging.isOverdue) {
        totalOverdueBase += balanceBase;
        if (aging.overdueDays <= 30) agingBuckets.days1_30 += balanceBase;
        else if (aging.overdueDays <= 60) agingBuckets.days31_60 += balanceBase;
        else if (aging.overdueDays <= 90) agingBuckets.days61_90 += balanceBase;
        else agingBuckets.days90Plus += balanceBase;
      } else {
        totalPendingBase += balanceBase;
        agingBuckets.current += balanceBase;
      }
    } else if (isReceivable(inv)) {
      currencyBreakdown[curr].pending += rawAmt;

      if (aging.isOverdue && !isOnHold(inv.status)) {
        totalOverdueBase += baseAmt;
        if (aging.overdueDays <= 30) agingBuckets.days1_30 += baseAmt;
        else if (aging.overdueDays <= 60) agingBuckets.days31_60 += baseAmt;
        else if (aging.overdueDays <= 90) agingBuckets.days61_90 += baseAmt;
        else agingBuckets.days90Plus += baseAmt;
      } else {
        totalPendingBase += baseAmt;
        agingBuckets.current += baseAmt;
      }
    }
  });

  const avgDaysToCollect = receivedCount > 0 ? Math.round(totalCollectionDays / receivedCount) : 0;
  const collectionRate = totalInvoicedBase > 0 ? Math.round((totalReceivedBase / totalInvoicedBase) * 100) : 0;

  return {
    totalInvoicedBase,
    totalReceivedBase,
    totalPendingBase,
    totalOverdueBase,
    totalTaxWithheldBase,
    totalVoidedBase,
    voidedCount,
    avgDaysToCollect,
    collectionRate,
    currencyBreakdown,
    monthlyData: Object.values(monthlyData).sort((a, b) => a.key.localeCompare(b.key)),
    agingBuckets
  };
}

/**
 * Deterministic, accessible color generator for client avatar badges
 */
export function getClientColor(clientName = "") {
  const name = String(clientName).trim().toUpperCase();
  const presets = {
    A: { bg: "oklch(0.24 0.07 145)", text: "oklch(0.88 0.16 145)", border: "oklch(0.38 0.10 145)" },
    B: { bg: "oklch(0.24 0.07 260)", text: "oklch(0.88 0.16 260)", border: "oklch(0.38 0.10 260)" },
    V: { bg: "oklch(0.25 0.07 75)",  text: "oklch(0.88 0.14 75)",  border: "oklch(0.38 0.09 75)" },
    D: { bg: "oklch(0.24 0.07 215)", text: "oklch(0.88 0.15 215)", border: "oklch(0.38 0.10 215)" },
    E: { bg: "oklch(0.24 0.08 340)", text: "oklch(0.88 0.16 340)", border: "oklch(0.38 0.10 340)" }
  };

  if (presets[name]) return presets[name];

  const palette = [
    { bg: "oklch(0.24 0.07 145)", text: "oklch(0.88 0.16 145)", border: "oklch(0.38 0.10 145)" },
    { bg: "oklch(0.24 0.07 260)", text: "oklch(0.88 0.16 260)", border: "oklch(0.38 0.10 260)" },
    { bg: "oklch(0.25 0.07 75)",  text: "oklch(0.88 0.14 75)",  border: "oklch(0.38 0.09 75)" },
    { bg: "oklch(0.24 0.07 215)", text: "oklch(0.88 0.15 215)", border: "oklch(0.38 0.10 215)" },
    { bg: "oklch(0.24 0.08 340)", text: "oklch(0.88 0.16 340)", border: "oklch(0.38 0.10 340)" },
    { bg: "oklch(0.24 0.07 185)", text: "oklch(0.88 0.15 185)", border: "oklch(0.38 0.10 185)" },
    { bg: "oklch(0.24 0.07 290)", text: "oklch(0.88 0.16 290)", border: "oklch(0.38 0.10 290)" },
    { bg: "oklch(0.25 0.07 40)",  text: "oklch(0.88 0.15 40)",  border: "oklch(0.38 0.10 40)" }
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}



function ensureMonthBucket(monthlyData, period) {
  if (!monthlyData[period.key]) {
    monthlyData[period.key] = {
      key: period.key,
      month: period.month,
      monthIndex: period.monthIndex,
      year: period.year,
      label: period.label,
      invoiced: 0,
      received: 0,
      count: 0
    };
  }
  return monthlyData[period.key];
}

/**
 * Resolve the accounting period an invoice belongs to, from its raised date.
 *
 * Everything year-aware in the app funnels through this, so the ledger filter, the
 * analytics chart and any export all agree on which month an invoice lands in.
 */
export function getPeriod(invoice) {
  const iso = invoice?.raisedOn || "";
  const match = /^(\d{4})-(\d{2})/.exec(iso);

  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const month = MONTH_NAMES[monthIndex] || "Unknown";
    return { key: `${match[1]}-${match[2]}`, year, monthIndex, month, label: `${month.slice(0, 3)} ${year}` };
  }

  // Fall back to a parseable date, then to the stored month name with no year.
  const d = iso ? new Date(iso) : null;
  if (d && !isNaN(d.getTime())) {
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const month = MONTH_NAMES[monthIndex];
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    return { key, year, monthIndex, month, label: `${month.slice(0, 3)} ${year}` };
  }

  const month = invoice?.invoicedMonth || "Unknown";
  return { key: `0000-${String(MONTH_NAMES.indexOf(month) + 1).padStart(2, "0")}`, year: null, monthIndex: MONTH_NAMES.indexOf(month), month, label: month };
}

/** Every year present in the ledger, newest first. */
export function getAvailableYears(invoices = []) {
  const years = new Set();
  invoices.forEach((inv) => {
    const { year } = getPeriod(inv);
    if (year) years.add(year);
  });
  return Array.from(years).sort((a, b) => b - a);
}

/** Aging bucket label for a single invoice - shared by the table filter and reports. */
export function getAgingBucket(invoice) {
  const eff = getEffectiveStatus(invoice);
  if (eff === "Received") return "settled";
  if (isOnHold(eff)) return "onhold";
  const { isOverdue, overdueDays } = calculateAging(invoice);
  if (!isOverdue) return "current";
  if (overdueDays <= 30) return "1-30";
  if (overdueDays <= 60) return "31-60";
  if (overdueDays <= 90) return "61-90";
  return "90+";
}

/** True when the invoice carries a withholding / TDS deduction. */
export function hasTaxDeduction(invoice) {
  if (Number(invoice?.taxAmount || 0) > 0) return true;
  if (Number(invoice?.taxRate || 0) > 0) return true;
  return /\btds\b|tax|withh/i.test(String(invoice?.remarks || ""));
}


/** Years present in a monthlyData series, newest first. */
export function getChartYears(monthlyData = []) {
  const years = new Set();
  monthlyData.forEach((d) => { if (d.year) years.add(d.year); });
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Turn year-keyed monthly buckets into a readable bar series.
 *
 * Passing "all" rolls the whole ledger up to one bar per year - the only legible
 * way to look at a decade of invoices. Passing a year returns all twelve months of
 * it, so a month with no billing reads as a gap rather than silently disappearing.
 */
export function buildChartSeries(monthlyData = [], activeYear) {
  if (activeYear === "all") {
    const byYear = new Map();
    monthlyData.forEach((d) => {
      if (!d.year) return;
      const row = byYear.get(d.year) || { label: String(d.year), invoiced: 0, received: 0, count: 0 };
      row.invoiced += d.invoiced;
      row.received += d.received;
      row.count += d.count;
      byYear.set(d.year, row);
    });
    return Array.from(byYear.entries()).sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  }

  if (activeYear === null || activeYear === undefined) return [];

  const yearRows = monthlyData.filter((d) => d.year === activeYear);
  return MONTH_NAMES.map((name, idx) => {
    const found = yearRows.find((d) => d.monthIndex === idx);
    return {
      label: name.slice(0, 3),
      invoiced: found ? found.invoiced : 0,
      received: found ? found.received : 0,
      count: found ? found.count : 0
    };
  });
}


/** Currency codes actually present in a ledger, sorted. */
export function getUsedCurrencies(invoices = []) {
  const codes = new Set();
  invoices.forEach((i) => {
    const c = String(i?.currency || "").trim().toUpperCase();
    if (c) codes.add(c);
  });
  return Array.from(codes).sort();
}

/**
 * Calculate client portfolio rankings, concentration risk, and payment reliability.
 */
export function calculateClientPortfolio(invoices = [], baseCurrency = "USD", rates = {}) {
  const clientMap = new Map();
  let grandTotalBilled = 0;
  let grandTotalCollected = 0;
  let grandTotalOutstanding = 0;

  invoices.forEach((inv) => {
    if (isTerminalStatus(inv.status)) return;
    const name = String(inv.clientName || "Unnamed Client").trim();
    const curr = inv.currency || "USD";
    const amount = Number(inv.amount || 0);
    const baseAmt = convertToBaseCurrency(amount, curr, baseCurrency, rates);
    const aging = calculateAging(inv);
    const eff = getEffectiveStatus(inv);

    grandTotalBilled += baseAmt;

    let row = clientMap.get(name);
    if (!row) {
      row = {
        name,
        totalBilled: 0,
        totalCollected: 0,
        totalPending: 0,
        totalOverdue: 0,
        invoiceCount: 0,
        settledCount: 0,
        overdueCount: 0,
        totalCollectionDays: 0,
        avgDaysToCollect: null,
        reliability: "Pending",
        currency: curr
      };
      clientMap.set(name, row);
    }

    row.totalBilled += baseAmt;
    row.invoiceCount += 1;

    if (eff === "Received") {
      const netBase = convertToBaseCurrency(Number(inv.netReceived || amount), curr, baseCurrency, rates);
      row.totalCollected += netBase;
      row.settledCount += 1;
      grandTotalCollected += netBase;
      if (aging.daysToCollect !== null) {
        row.totalCollectionDays += aging.daysToCollect;
      }
    } else if (isPartiallyPaid(inv.status)) {
      const recBase = convertToBaseCurrency(Number(inv.netReceived || 0), curr, baseCurrency, rates);
      const balBase = convertToBaseCurrency(getBalanceDue(inv), curr, baseCurrency, rates);
      row.totalCollected += recBase;
      grandTotalCollected += recBase;
      grandTotalOutstanding += balBase;
      if (aging.isOverdue) {
        row.totalOverdue += balBase;
        row.overdueCount += 1;
      } else {
        row.totalPending += balBase;
      }
    } else if (isReceivable(inv)) {
      grandTotalOutstanding += baseAmt;
      if (aging.isOverdue && !isOnHold(inv.status)) {
        row.totalOverdue += baseAmt;
        row.overdueCount += 1;
      } else {
        row.totalPending += baseAmt;
      }
    }
  });

  const clients = Array.from(clientMap.values()).map((c) => {
    const avgDays = c.settledCount > 0 ? Math.round(c.totalCollectionDays / c.settledCount) : null;
    let reliability = "No History";
    let reliabilityClass = "reliability-neutral";

    if (avgDays !== null) {
      if (avgDays <= 15) {
        reliability = "Fast Payer (<15d)";
        reliabilityClass = "reliability-fast";
      } else if (avgDays <= 35) {
        reliability = "Standard (<35d)";
        reliabilityClass = "reliability-standard";
      } else {
        reliability = "Slow Payer (>35d)";
        reliabilityClass = "reliability-slow";
      }
    } else if (c.overdueCount > 0) {
      reliability = "Overdue Risk";
      reliabilityClass = "reliability-risk";
    }

    const sharePct = grandTotalBilled > 0 ? ((c.totalBilled / grandTotalBilled) * 100).toFixed(1) : "0.0";

    return {
      ...c,
      avgDaysToCollect: avgDays,
      reliability,
      reliabilityClass,
      sharePct: parseFloat(sharePct),
      totalOutstanding: c.totalPending + c.totalOverdue
    };
  });

  // Sort by total billed descending
  clients.sort((a, b) => b.totalBilled - a.totalBilled);

  // Calculate top 3 client concentration ratio
  const top3Total = clients.slice(0, 3).reduce((acc, c) => acc + c.totalBilled, 0);
  const top3ConcentrationPct = grandTotalBilled > 0 ? Math.round((top3Total / grandTotalBilled) * 100) : 0;

  return {
    clients,
    clientCount: clients.length,
    grandTotalBilled,
    grandTotalCollected,
    grandTotalOutstanding,
    top3ConcentrationPct
  };
}

/**
 * Detailed Accounts Receivable (AR) aging analysis across 5 time buckets.
 */
export function calculateAgingDetails(invoices = [], baseCurrency = "USD", rates = {}) {
  const buckets = {
    current: { label: "Current (Within Terms)", amount: 0, count: 0, key: "current" },
    days1_30: { label: "1–30 Days Overdue", amount: 0, count: 0, key: "1-30" },
    days31_60: { label: "31–60 Days Overdue", amount: 0, count: 0, key: "31-60" },
    days61_90: { label: "61–90 Days Overdue", amount: 0, count: 0, key: "61-90" },
    days90Plus: { label: "90+ Days Overdue (Critical)", amount: 0, count: 0, key: "90+" }
  };

  let totalOutstanding = 0;
  let totalOverdue = 0;
  const criticalInvoices = [];

  invoices.forEach((inv) => {
    if (isTerminalStatus(inv.status) || inv.status === "Received") return;
    const curr = inv.currency || "USD";
    const aging = calculateAging(inv);
    const bal = isPartiallyPaid(inv.status) ? getBalanceDue(inv) : Number(inv.amount || 0);
    const baseBal = convertToBaseCurrency(bal, curr, baseCurrency, rates);

    if (baseBal <= 0) return;
    totalOutstanding += baseBal;

    if (aging.isOverdue && !isOnHold(inv.status)) {
      totalOverdue += baseBal;
      criticalInvoices.push({
        ...inv,
        baseBalance: baseBal,
        overdueDays: aging.overdueDays
      });

      if (aging.overdueDays <= 30) {
        buckets.days1_30.amount += baseBal;
        buckets.days1_30.count += 1;
      } else if (aging.overdueDays <= 60) {
        buckets.days31_60.amount += baseBal;
        buckets.days31_60.count += 1;
      } else if (aging.overdueDays <= 90) {
        buckets.days61_90.amount += baseBal;
        buckets.days61_90.count += 1;
      } else {
        buckets.days90Plus.amount += baseBal;
        buckets.days90Plus.count += 1;
      }
    } else {
      buckets.current.amount += baseBal;
      buckets.current.count += 1;
    }
  });

  // Sort critical overdue invoices by most overdue first
  criticalInvoices.sort((a, b) => b.overdueDays - a.overdueDays);

  const bucketList = Object.values(buckets).map((b) => ({
    ...b,
    pct: totalOutstanding > 0 ? Math.round((b.amount / totalOutstanding) * 100) : 0
  }));

  return {
    bucketList,
    totalOutstanding,
    totalOverdue,
    overduePct: totalOutstanding > 0 ? Math.round((totalOverdue / totalOutstanding) * 100) : 0,
    criticalInvoices: criticalInvoices.slice(0, 8)
  };
}

/**
 * Cash Inflow Forecast based on upcoming invoice due dates.
 */
export function calculateCashForecast(invoices = [], baseCurrency = "USD", rates = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slots = {
    thisWeek: { label: "Due This Week (1–7d)", amount: 0, count: 0 },
    nextWeek: { label: "Due Next Week (8–14d)", amount: 0, count: 0 },
    in30Days: { label: "Due in 15–30 Days", amount: 0, count: 0 },
    later: { label: "Due Later (>30d)", amount: 0, count: 0 },
    overdue: { label: "Past Due", amount: 0, count: 0 }
  };

  let totalForecastInflow = 0;

  invoices.forEach((inv) => {
    if (isTerminalStatus(inv.status) || inv.status === "Received") return;
    const curr = inv.currency || "USD";
    const bal = isPartiallyPaid(inv.status) ? getBalanceDue(inv) : Number(inv.amount || 0);
    const baseBal = convertToBaseCurrency(bal, curr, baseCurrency, rates);

    if (baseBal <= 0) return;

    const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
    if (dueDate) dueDate.setHours(0, 0, 0, 0);

    if (!dueDate || isNaN(dueDate.getTime())) {
      slots.later.amount += baseBal;
      slots.later.count += 1;
      totalForecastInflow += baseBal;
      return;
    }

    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      slots.overdue.amount += baseBal;
      slots.overdue.count += 1;
    } else if (diffDays <= 7) {
      slots.thisWeek.amount += baseBal;
      slots.thisWeek.count += 1;
      totalForecastInflow += baseBal;
    } else if (diffDays <= 14) {
      slots.nextWeek.amount += baseBal;
      slots.nextWeek.count += 1;
      totalForecastInflow += baseBal;
    } else if (diffDays <= 30) {
      slots.in30Days.amount += baseBal;
      slots.in30Days.count += 1;
      totalForecastInflow += baseBal;
    } else {
      slots.later.amount += baseBal;
      slots.later.count += 1;
      totalForecastInflow += baseBal;
    }
  });

  return {
    slots: Object.entries(slots).map(([key, data]) => ({
      key,
      ...data,
      pct: totalForecastInflow > 0 && key !== "overdue" ? Math.round((data.amount / totalForecastInflow) * 100) : 0
    })),
    totalForecastInflow
  };
}

/**
 * Breakdown of billing and settlements by Payment Channel / Mode.
 */
export function calculatePaymentChannels(invoices = [], baseCurrency = "USD", rates = {}) {
  const channelMap = new Map();
  let totalBilled = 0;

  invoices.forEach((inv) => {
    if (isTerminalStatus(inv.status)) return;
    const mode = String(inv.paymentMode || "Direct Transfer").trim();
    const curr = inv.currency || "USD";
    const amount = Number(inv.amount || 0);
    const baseAmt = convertToBaseCurrency(amount, curr, baseCurrency, rates);
    const eff = getEffectiveStatus(inv);

    totalBilled += baseAmt;

    let row = channelMap.get(mode);
    if (!row) {
      row = { mode, totalBilled: 0, totalCollected: 0, count: 0 };
      channelMap.set(mode, row);
    }

    row.totalBilled += baseAmt;
    row.count += 1;

    if (eff === "Received") {
      const netBase = convertToBaseCurrency(Number(inv.netReceived || amount), curr, baseCurrency, rates);
      row.totalCollected += netBase;
    } else if (isPartiallyPaid(inv.status)) {
      const recBase = convertToBaseCurrency(Number(inv.netReceived || 0), curr, baseCurrency, rates);
      row.totalCollected += recBase;
    }
  });

  const channels = Array.from(channelMap.values()).map((c) => ({
    ...c,
    sharePct: totalBilled > 0 ? Math.round((c.totalBilled / totalBilled) * 100) : 0
  }));

  channels.sort((a, b) => b.totalBilled - a.totalBilled);

  return { channels, totalBilled };
}

