// Financial Calculation & Data Aggregation Utilities
import { CURRENCIES } from "../types/finance";

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
  } else if (invoice.status !== "Cancelled" && invoice.status !== "Draft") {
    if (raisedDate) {
      const diffMs = today.getTime() - raisedDate.getTime();
      daysOutstanding = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
    if (dueDate && today > dueDate) {
      isOverdue = true;
      const overdueMs = today.getTime() - dueDate.getTime();
      overdueDays = Math.max(1, Math.round(overdueMs / (1000 * 60 * 60 * 24)));
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

  const defaultRates = {
    USD: 1.0,
    EUR: 1.08,
    GBP: 1.28,
    CHF: 1.14,
    INR: 0.012,
    CAD: 0.74,
    AUD: 0.66,
    SGD: 0.75,
    ...rates
  };

  const fromRateInUSD = defaultRates[currencyCode] || 1.0;
  const toRateInUSD = defaultRates[baseCurrencyCode] || 1.0;

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

    // Currency stats
    if (!currencyBreakdown[curr]) {
      currencyBreakdown[curr] = { total: 0, received: 0, pending: 0, count: 0 };
    }
    currencyBreakdown[curr].total += rawAmt;
    currencyBreakdown[curr].count += 1;

    // Month trend
    const month = inv.invoicedMonth || (inv.raisedOn ? getMonthName(inv.raisedOn) : "Unknown");
    if (!monthlyData[month]) {
      monthlyData[month] = { month, invoiced: 0, received: 0, count: 0 };
    }
    monthlyData[month].invoiced += baseAmt;
    monthlyData[month].count += 1;

    totalInvoicedBase += baseAmt;

    if (inv.status === "Received") {
      const netBase = convertToBaseCurrency(Number(inv.netReceived || rawAmt), curr, baseCurrency, rates);
      const taxBase = convertToBaseCurrency(Number(inv.taxAmount || 0), curr, baseCurrency, rates);
      totalReceivedBase += netBase;
      totalTaxWithheldBase += taxBase;
      currencyBreakdown[curr].received += rawAmt;
      monthlyData[month].received += netBase;

      if (aging.daysToCollect !== null) {
        totalCollectionDays += aging.daysToCollect;
        receivedCount += 1;
      }
    } else if (inv.status !== "Cancelled" && inv.status !== "Draft") {
      currencyBreakdown[curr].pending += rawAmt;

      if (aging.isOverdue) {
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
    avgDaysToCollect,
    collectionRate,
    currencyBreakdown,
    monthlyData: Object.values(monthlyData),
    agingBuckets
  };
}
