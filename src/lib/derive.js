// Every number the UI shows is derived here from the raw workbook rows, so the
// ledger stays the single source of truth and nothing is cached out of sync.
import { daysBetween, today, monthOf } from "./format.js";

/**
 * Rates are quoted against the workbook's own base currency: rates[X] = how many base
 * units one X is worth, so the base itself is 1. Converting between any two currencies
 * pivots through that base — which is why switching the display currency re-expresses
 * every total instead of hiding rows.
 */
export function convert(amount, from, to, rates) {
  const a = Number(amount || 0);
  if (!a || from === to) return a;
  const fromRate = Number(rates?.[from]) || 1;
  const toRate = Number(rates?.[to]) || 1;
  return (a * fromRate) / toRate;
}

/** @param display currency every `base`/`receivedBase` figure is expressed in. */
export function decorate(invoices, rates, display) {
  const now = today();
  return invoices.map((inv) => {
    const overdueDays = inv.status === "Received" ? 0 : Math.max(0, daysBetween(inv.dueDate, now));
    const status = inv.status === "Received" ? "Received" : overdueDays > 0 ? "Overdue" : "Outstanding";
    const received = status === "Received" ? Number(inv.amountReceived || inv.amount) : 0;
    return {
      ...inv,
      status,
      overdueDays,
      daysToDue: inv.status === "Received" ? 0 : -daysBetween(now, inv.dueDate),
      daysToCollect: inv.receivedOn ? daysBetween(inv.raisedOn, inv.receivedOn) : null,
      receivedAmount: received,
      shortfall: status === "Received" ? Number(inv.amount) - received : 0,
      base: convert(inv.amount, inv.currency, display, rates),
      receivedBase: convert(received, inv.currency, display, rates),
      taxBase: convert(inv.taxAmount, inv.currency, display, rates),
      month: inv.invoicedMonth || monthOf(inv.raisedOn)
    };
  });
}

export function totals(list) {
  const invoiced = list.reduce((a, i) => a + i.base, 0);
  const collected = list.reduce((a, i) => a + i.receivedBase, 0);
  const open = list.filter((i) => i.status !== "Received");
  const overdueSet = list.filter((i) => i.status === "Overdue");
  const paid = list.filter((i) => i.daysToCollect !== null);
  return {
    invoiced,
    collected,
    outstanding: open.reduce((a, i) => a + i.base, 0),
    overdue: overdueSet.reduce((a, i) => a + i.base, 0),
    overdueCount: overdueSet.length,
    openCount: open.length,
    withheld: list.reduce((a, i) => a + i.taxBase, 0),
    collectionRate: invoiced ? (collected / invoiced) * 100 : 0,
    avgDaysToCollect: paid.length ? Math.round(paid.reduce((a, i) => a + i.daysToCollect, 0) / paid.length) : 0,
    oldestOverdue: Math.max(0, ...overdueSet.map((i) => i.overdueDays), 0)
  };
}

export const AGING_BUCKETS = [
  { label: "Current", color: "#41505F", test: (d) => d <= 0 },
  { label: "1–30 days", color: "#5C7FA8", test: (d) => d > 0 && d <= 30 },
  { label: "31–60 days", color: "#8FA9C6", test: (d) => d > 30 && d <= 60 },
  { label: "61–90 days", color: "#C8A96B", test: (d) => d > 60 && d <= 90 },
  { label: "90+ days", color: "#A8382F", test: (d) => d > 90 }
];

export function aging(list) {
  const open = list.filter((i) => i.status !== "Received");
  const total = open.reduce((a, i) => a + i.base, 0) || 1;
  return AGING_BUCKETS.map((b) => {
    const set = open.filter((i) => b.test(i.overdueDays));
    const amount = set.reduce((a, i) => a + i.base, 0);
    return { ...b, count: set.length, amount, pct: (amount / total) * 100 };
  });
}

/** Monthly invoiced-vs-collected series, keyed by the month the invoice was raised. */
export function byMonth(list, months) {
  return months.map((key) => {
    const set = list.filter((i) => i.raisedOn.slice(0, 7) === key);
    return {
      key,
      label: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(key.slice(5, 7)) - 1],
      year: key.slice(0, 4),
      invoiced: set.reduce((a, i) => a + i.base, 0),
      collected: set.reduce((a, i) => a + i.receivedBase, 0),
      count: set.length,
      collectedCount: set.filter((i) => i.status === "Received").length
    };
  });
}

/** The last `n` months up to the newest invoice (or today), as YYYY-MM keys. */
export function monthKeys(list, n) {
  const latest = list.reduce((a, i) => (i.raisedOn > a ? i.raisedOn : a), today());
  const end = new Date(latest.slice(0, 7) + "-01T00:00:00Z");
  const keys = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - k, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

export function behaviorOf(avgDays, outstanding) {
  if (!avgDays) return { label: "New", pips: 2, color: "#9AA6B2", note: "No settled invoices yet." };
  if (avgDays <= 32) return { label: "Prompt", pips: 5, color: "#2F6B4F", note: "Pays inside terms consistently. No escalation needed." };
  if (avgDays <= 42) return { label: "Steady", pips: 4, color: "#41505F", note: "Reliable, usually a few days past terms." };
  if (outstanding > 0) return { label: "Slow", pips: 2, color: "#A8382F", note: "Requires follow-up. Consider shorter terms on the next contract." };
  return { label: "Late", pips: 3, color: "#C8862B", note: "Settles eventually, but well past agreed terms." };
}

export function clientStats(list, clients) {
  return (clients || [])
    .filter((c) => c && (c.name || c.fullName))
    .map((c) => {
      const cName = c.name || c.fullName;
      const set = (list || []).filter((i) => i.clientName === cName || (c.name && i.clientName === c.name));
      const paid = set.filter((i) => i.daysToCollect !== null);
      const invoiced = set.reduce((a, i) => a + (i.base || 0), 0);
      const collected = set.reduce((a, i) => a + (i.receivedBase || 0), 0);
      const outstanding = set.filter((i) => i.status !== "Received").reduce((a, i) => a + (i.base || 0), 0);
      const avgDays = paid.length ? Math.round(paid.reduce((a, i) => a + i.daysToCollect, 0) / paid.length) : 0;
      return {
        ...c,
        name: cName,
        invoices: set,
        count: set.length,
        invoiced,
        collected,
        outstanding,
        avgDays,
        fastest: paid.length ? Math.min(...paid.map((i) => i.daysToCollect)) : null,
        slowest: paid.length ? Math.max(...paid.map((i) => i.daysToCollect)) : null,
        onTimeRate: paid.length
          ? Math.round((paid.filter((i) => i.receivedOn <= i.dueDate).length / paid.length) * 100)
          : null,
        preferredMode: mode(set.map((i) => i.paymentMode)),
        behavior: behaviorOf(avgDays, outstanding)
      };
    })
    .sort((a, b) => (b.invoiced || 0) - (a.invoiced || 0));
}

function mode(values) {
  const counts = {};
  for (const v of values) if (v) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}

/** Next number in the prefix series, so the ledger keeps one unbroken sequence. */
export function nextInvoiceNo(invoices, prefix) {
  const series = new RegExp(`^${prefix}(\\d+)$`, "i");
  const highest = invoices.reduce((max, i) => {
    const m = series.exec(i.invoiceNo.trim());
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const width = Math.max(5, String(highest).length);
  return `${prefix}${String(highest + 1).padStart(width, "0")}`;
}

export const initialsOf = (name) => {
  const s = String(name || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
};
