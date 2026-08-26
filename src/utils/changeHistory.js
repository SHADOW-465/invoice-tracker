import { formatCurrency } from "./calculations";

export const HISTORY_CAP = 5000;

export const HISTORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "payments", label: "Payments" },
  { value: "edits", label: "Edits" },
  { value: "deletes", label: "Deletes" },
  { value: "imports", label: "Imports" }
];

const PAYMENT_ACTIONS = new Set(["paid", "partial"]);
const EDIT_ACTIONS = new Set(["created", "updated", "duplicated"]);

export function eventMatchesFilter(event, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "payments") return PAYMENT_ACTIONS.has(event.action);
  if (filter === "edits") return EDIT_ACTIONS.has(event.action);
  if (filter === "deletes") return event.action === "deleted";
  if (filter === "imports") return event.action === "imported";
  return true;
}

export function eventMatchesQuery(event, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return (
    String(event.invoiceNo || "").toLowerCase().includes(q) ||
    String(event.clientName || "").toLowerCase().includes(q) ||
    String(event.summary || "").toLowerCase().includes(q)
  );
}

export function cloneInvoice(inv) {
  if (!inv) return null;
  try {
    return JSON.parse(JSON.stringify(inv));
  } catch {
    return { ...inv };
  }
}

export function cloneInvoices(list) {
  if (!Array.isArray(list)) return [];
  try {
    return JSON.parse(JSON.stringify(list));
  } catch {
    return list.map((i) => ({ ...i }));
  }
}

const COMPARE_KEYS = [
  "invoiceNo", "clientName", "amount", "currency", "paymentMode",
  "raisedOn", "invoicedMonth", "status", "receivedOn", "paymentTerms",
  "dueDate", "taxRate", "taxAmount", "netReceived", "remarks"
];

export function invoicesEquivalent(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return COMPARE_KEYS.every((k) => String(a[k] ?? "") === String(b[k] ?? ""));
}

export function makeHistoryEvent({
  action,
  workspaceId,
  invoice,
  before = null,
  after = null,
  summary,
  batchId = null,
  extra = {}
}) {
  const target = after || invoice || before || {};
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    createdAt: new Date().toISOString(),
    action,
    invoiceId: extra.invoiceId !== undefined ? extra.invoiceId : (target.id || before?.id || null),
    invoiceNo: extra.invoiceNo !== undefined ? extra.invoiceNo : (target.invoiceNo || before?.invoiceNo || ""),
    clientName: extra.clientName !== undefined ? extra.clientName : (target.clientName || before?.clientName || ""),
    summary,
    before,
    after,
    batchId,
    undone: false
  };
}

export function summariseCreated(inv) {
  return `Created ${inv.invoiceNo} for ${inv.clientName || "a client"} (${formatCurrency(inv.amount, inv.currency)})`;
}

export function summariseUpdated(before, after) {
  const no = after?.invoiceNo || before?.invoiceNo || "invoice";
  if (before && after && before.status !== after.status) {
    return `Changed ${no} from ${before.status} to ${after.status}`;
  }
  if (before && after && before.receivedOn !== after.receivedOn) {
    return `Changed received date on ${no}`;
  }
  if (before && after && Number(before.amount) !== Number(after.amount)) {
    return `Updated amount on ${no}`;
  }
  return `Updated ${no}`;
}

export function summarisePaid(inv) {
  return `Marked ${inv.invoiceNo} Received (${formatCurrency(inv.netReceived || inv.amount, inv.currency)})`;
}

export function summarisePartial(inv) {
  return `Marked ${inv.invoiceNo} Partially Paid (${formatCurrency(inv.netReceived, inv.currency)} of ${formatCurrency(inv.amount, inv.currency)})`;
}

export function summariseDuplicated(source, copy) {
  return `Duplicated ${source.invoiceNo} as ${copy.invoiceNo}`;
}

export function summariseDeleted(inv) {
  return `Deleted ${inv.invoiceNo} (${inv.clientName || "no client"})`;
}

export function summariseImported({ count, mode, fileName }) {
  const label = mode === "replace" ? "replace" : mode === "new_workspace" ? "new ledger" : "merge";
  const from = fileName ? ` from ${fileName}` : "";
  return `Imported ${count} invoice${count === 1 ? "" : "s"} (${label})${from}`;
}

export function summariseRestored(event) {
  if (event.action === "imported") return "Restored ledger to before that import";
  const no = event.invoiceNo || "invoice";
  if (event.action === "created") return `Removed newly created ${no}`;
  if (event.action === "deleted") return `Restored deleted ${no}`;
  return `Restored ${no} to previous version`;
}

export function actionLabel(action, undone = false) {
  if (undone) return "Undone";
  switch (action) {
    case "created": return "Created";
    case "updated": return "Edited";
    case "paid": return "Received";
    case "partial": return "Partial";
    case "duplicated": return "Duplicated";
    case "deleted": return "Deleted";
    case "imported": return "Imported";
    default: return action || "Change";
  }
}

export function actionPillClass(action) {
  if (action === "paid") return "status-received";
  if (action === "partial") return "status-partial";
  if (action === "deleted") return "status-overdue";
  if (action === "imported") return "status-pending";
  if (action === "restored") return "status-suspended";
  if (action === "created") return "status-draft";
  return "status-pending";
}

export function formatRelativeTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
  if (delta < day) return `${Math.floor(delta / hour)}h ago`;
  if (delta < 7 * day) return `${Math.floor(delta / day)}d ago`;
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

export function pruneEvents(events, workspaceId, cap = HISTORY_CAP) {
  const list = Array.isArray(events) ? events : [];
  const keep = [];
  const counts = {};
  for (const ev of list) {
    const ws = ev.workspaceId || workspaceId;
    counts[ws] = (counts[ws] || 0) + 1;
    if (counts[ws] <= cap) keep.push(ev);
  }
  return keep;
}

export function actionForFieldUpdate(before, after) {
  if (!after) return "updated";
  if (after.status === "Partially Paid" && before?.status !== "Partially Paid") return "partial";
  if (after.status === "Received" && before?.status !== "Received") return "paid";
  return "updated";
}
