// The workbook mapping — pure functions over bytes, no filesystem.
// This is the single implementation of "what the spreadsheet means". The Node server
// and the Tauri desktop build both drive it; neither owns a second copy of the rules.
import * as XLSX from "xlsx";

const INVOICE_SHEET = "Invoices";
const CLIENT_SHEET = "Clients";
const SETTINGS_SHEET = "Settings";

export const DEFAULT_SETTINGS = {
  workspaceName: "Sengupta & Sons",
  workspaceEmail: "accounts@example.com",
  workspaceAddress: "",
  taxId: "",
  baseCurrency: "INR",
  invoicePrefix: "SnS",
  defaultTermDays: 30,
  defaultPaymentMode: "Online",
  bankDetails: "",
  rates: { INR: 1, USD: 87.4, GBP: 111.2, CHF: 108.5, EUR: 94.8 }
};

// --- cell coercion -----------------------------------------------------------

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const round2 = (n) => Math.round(n * 100) / 100;

export function toISO(v) {
  if (v === null || v === undefined || v === "" || v === "-") return "";
  if (v instanceof Date) {
    // SheetJS lands date cells a few seconds short of local midnight (46028 comes back
    // as Jan 05 23:59:50). Nudge past the boundary, then read local calendar parts —
    // reading UTC parts would shift the day for anyone east of Greenwich.
    const d = new Date(v.getTime() + 60000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") return new Date(EXCEL_EPOCH + v * 86400000).toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? "" : toISO(d);
}

export function num(v) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

const DATE_COLUMNS = ["Raised on", "Received on", "Due Date"];

/** ISO date → Excel serial. Done by hand: SheetJS's own Date conversion lands 10
 *  seconds past midnight, which shows up as a time component in Excel. */
const toSerial = (iso) =>
  Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000 + 25569;

/** Rewrite the date columns as real, whole-day date cells so Excel still sees dates. */
function stampDates(sheet) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const header = sheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
    if (!header || !DATE_COLUMNS.includes(header.v)) continue;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[ref];
      if (cell && typeof cell.v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cell.v)) {
        sheet[ref] = { t: "n", v: toSerial(cell.v), z: "yyyy-mm-dd" };
      }
    }
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export const monthOf = (iso) => (iso ? MONTHS[Number(iso.slice(5, 7)) - 1] : "");
// The user's calendar date, not UTC's. Between midnight and 05:30 in IST the UTC date
// is still yesterday, which would date receipts a day early and misreport overdue days.
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function addDays(iso, days) {
  if (!iso) return "";
  return new Date(new Date(iso + "T00:00:00Z").getTime() + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISOStr) {
  if (!fromISO || !toISOStr) return 0;
  return Math.round((new Date(toISOStr) - new Date(fromISO)) / 86400000);
}

// --- column mapping ----------------------------------------------------------
// Legacy header names from the hand-kept sheet are accepted on read; writes always
// use the canonical names, so the file converges on one shape after the first save.

const pick = (row, ...names) => {
  for (const n of names) {
    const key = Object.keys(row).find(
      (k) => k.replace(/\s+/g, " ").trim().toLowerCase() === n.toLowerCase()
    );
    if (key !== undefined && row[key] !== "") return row[key];
  }
  return "";
};

function rowToInvoice(row) {
  const raisedOn = toISO(pick(row, "Raised on", "Raised Date", "Invoice Date", "Date", "Bill Date", "Issue Date", "Dated", "Created"));
  const receivedOn = toISO(pick(row, "Received on", "Received Date", "Paid Date", "Payment Date", "Settled on", "Date Paid"));
  const amount = num(pick(row, "Actual Invoiced Amt", "Amount", "Invoiced Amt", "Total", "Invoice Amount", "Net Amount", "Gross Amount", "Value", "Bill Amount", "Price"));
  const rawStatus = String(pick(row, "Collection Status", "Status", "Payment Status", "State", "Invoice Status") || "").trim();
  const termDays = num(pick(row, "Term Days", "Terms", "Net Days", "Payment Terms")) || 30;
  const remarks = String(pick(row, "Remarks", "Notes", "Description", "Memo", "Comments", "Details") || "").trim();

  // A legacy sheet records withholding only in the remarks text ("after 15% tax deduction").
  const declared = num(pick(row, "Tax %", "Tax Rate", "TDS %", "TDS Rate", "Withholding %"));
  const taxRate = declared || num(/(\d+(?:\.\d+)?)\s*%/.exec(remarks)?.[1] ?? 0);
  const taxAmount = num(pick(row, "Tax Amount", "TDS Amount", "Tax Withheld", "Withheld Amount")) || round2((amount * taxRate) / 100);

  const receivedCell = pick(row, "Amount Received", "Net Received", "Received Amt", "Paid Amount");
  const amountReceived =
    receivedCell === "" ? (receivedOn ? round2(amount - taxAmount) : 0) : num(receivedCell);

  return {
    invoiceNo: String(pick(row, "Invoice #", "Invoice No", "Invoice No.", "Invoice", "Inv #", "Inv No", "Bill No", "Doc No", "Reference") || "").trim(),
    clientName: String(pick(row, "Client Name", "Client", "Customer", "Company", "Account", "Party Name", "Billed To", "Name") || "").trim(),
    amount,
    currency: String(pick(row, "UOM", "Currency", "Curr", "Unit", "Currency Code") || "USD").trim().toUpperCase(),
    paymentMode: String(pick(row, "Mode of Payment", "Payment Mode", "Payment Method", "Method", "Type", "Channel") || "Online").trim(),
    raisedOn,
    invoicedMonth: String(pick(row, "Invoiced Month", "Month") || monthOf(raisedOn)).trim(),
    // One vocabulary: Received or Outstanding on disk. "Overdue" is derived from the
    // due date at read time, so it can never go stale in the sheet. Legacy values
    // ("Pending", "Not received", …) all collapse to Outstanding.
    status: receivedOn || /^received$/i.test(rawStatus) ? "Received" : "Outstanding",
    receivedOn,
    dueDate: toISO(pick(row, "Due Date", "Due on", "Payment Due")) || addDays(raisedOn, termDays),
    termDays,
    taxRate,
    taxAmount,
    amountReceived,
    remarks
  };
}

function invoiceToRow(inv) {
  const open = inv.status !== "Received";
  return {
    "Invoice #": inv.invoiceNo,
    "Client Name": inv.clientName,
    "Actual Invoiced Amt": num(inv.amount),
    "Mode of Payment": inv.paymentMode || "Online",
    "UOM": inv.currency || "USD",
    "Raised on": inv.raisedOn || "",
    "Invoiced Month": inv.invoicedMonth || monthOf(inv.raisedOn),
    "Collection Status": inv.status,
    "Received on": inv.receivedOn || "",
    "Due Date": inv.dueDate || "",
    "Term Days": num(inv.termDays) || 30,
    "Due by (days)": open ? daysBetween(inv.dueDate, today()) : "-",
    "Tax %": num(inv.taxRate),
    "Tax Amount": round2(num(inv.taxAmount)),
    "Amount Received": inv.status === "Received" ? round2(num(inv.amountReceived)) : "",
    "Remarks": inv.remarks || ""
  };
}

const COL_WIDTHS = [14, 20, 20, 17, 7, 12, 15, 17, 12, 12, 10, 13, 8, 12, 15, 42];

// --- parse / build -----------------------------------------------------------

// The invoice sheet is whichever sheet is named "Invoices", else the first one — so an
// existing hand-kept workbook keeps working without being renamed first.
const invoiceSheetName = (wb) =>
  wb.SheetNames.includes(INVOICE_SHEET) ? INVOICE_SHEET : wb.SheetNames[0];

export function emptyWorkbook() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), INVOICE_SHEET);
  return wb;
}

/** Bytes (or null for a fresh ledger) → the whole dataset. */
export function parseWorkbook(bytes) {
  const wb = bytes ? XLSX.read(bytes, { type: "array", cellDates: true }) : emptyWorkbook();

  const invoices = XLSX.utils
    .sheet_to_json(wb.Sheets[invoiceSheetName(wb)], { defval: "" })
    .map(rowToInvoice)
    .filter((i) => i.invoiceNo && (i.clientName || i.amount > 0));

  const clients = wb.Sheets[CLIENT_SHEET]
    ? XLSX.utils
        .sheet_to_json(wb.Sheets[CLIENT_SHEET], { defval: "" })
        .map((r) => ({
          name: String(r["Client Name"] ?? "").trim(),
          fullName: String(r["Display Name"] ?? "").trim(),
          email: String(r["Email"] ?? "").trim(),
          currency: String(r["Currency"] ?? "").trim().toUpperCase(),
          termDays: num(r["Term Days"]) || 30,
          taxRate: num(r["Tax %"]),
          notes: String(r["Notes"] ?? "").trim()
        }))
        .filter((c) => c.name)
    : [];

  let settings = { ...DEFAULT_SETTINGS };
  if (wb.Sheets[SETTINGS_SHEET]) {
    const kv = {};
    for (const r of XLSX.utils.sheet_to_json(wb.Sheets[SETTINGS_SHEET], { defval: "" })) {
      if (r.Key) kv[String(r.Key).trim()] = r.Value;
    }
    const rates = { ...DEFAULT_SETTINGS.rates };
    for (const [k, v] of Object.entries(kv)) {
      const m = /^rate\.([A-Za-z]{3})$/.exec(k);
      if (m) rates[m[1].toUpperCase()] = num(v);
    }
    settings = {
      ...DEFAULT_SETTINGS,
      ...Object.fromEntries(Object.entries(kv).filter(([k]) => !k.startsWith("rate."))),
      defaultTermDays: num(kv.defaultTermDays) || 30,
      rates
    };
  }

  // The base currency is the unit every rate is quoted in, so it is always exactly 1.
  settings.rates = { ...settings.rates, [settings.baseCurrency]: 1 };

  // Clients that appear only on invoices still deserve a row in the UI.
  const known = new Set(clients.map((c) => c.name.toLowerCase()));
  for (const inv of invoices) {
    if (inv.clientName && !known.has(inv.clientName.toLowerCase())) {
      known.add(inv.clientName.toLowerCase());
      clients.push({
        name: inv.clientName, fullName: "", email: "",
        currency: inv.currency, termDays: 30, taxRate: 0, notes: ""
      });
    }
  }

  return { invoices, clients, settings };
}

/** Dataset → workbook bytes. `existing` preserves any other sheets already in the file. */
export function buildWorkbook({ invoices, clients, settings }, existing) {
  const wb = existing ? XLSX.read(existing, { type: "array", cellDates: true }) : emptyWorkbook();

  const invSheet = XLSX.utils.json_to_sheet(invoices.map(invoiceToRow));
  stampDates(invSheet);
  invSheet["!cols"] = COL_WIDTHS.map((wch) => ({ wch }));
  wb.Sheets[invoiceSheetName(wb)] = invSheet;

  const cliSheet = XLSX.utils.json_to_sheet(
    clients.map((c) => ({
      "Client Name": c.name,
      "Display Name": c.fullName || "",
      "Email": c.email || "",
      "Currency": c.currency || "",
      "Term Days": c.termDays || 30,
      "Tax %": c.taxRate || 0,
      "Notes": c.notes || ""
    }))
  );
  cliSheet["!cols"] = [16, 24, 28, 10, 11, 8, 40].map((wch) => ({ wch }));
  upsertSheet(wb, CLIENT_SHEET, cliSheet);

  const { rates, ...flat } = settings;
  const setSheet = XLSX.utils.json_to_sheet([
    ...Object.entries(flat).map(([Key, Value]) => ({ Key, Value })),
    ...Object.entries(rates || {}).map(([code, v]) => ({ Key: `rate.${code}`, Value: v }))
  ]);
  setSheet["!cols"] = [{ wch: 24 }, { wch: 52 }];
  upsertSheet(wb, SETTINGS_SHEET, setSheet);

  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

function upsertSheet(wb, name, sheet) {
  if (!wb.SheetNames.includes(name)) wb.SheetNames.push(name);
  wb.Sheets[name] = sheet;
}

// --- validation --------------------------------------------------------------
// Runs before anything reaches the workbook, in both the server and desktop builds.
// A bad row written here is a bad row forever.

const clean = (v) => String(v ?? "").trim();

export function validateInvoice(body, existing) {
  const errors = [];
  const invoiceNo = clean(body.invoiceNo);
  if (!invoiceNo) errors.push("Invoice number is required");
  if (!clean(body.clientName)) errors.push("Client name is required");

  const amount = Number(body.amount);
  if (!isFinite(amount) || amount <= 0) errors.push("Amount must be a positive number");

  const raisedOn = clean(body.raisedOn) || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raisedOn)) errors.push("Raised date must be YYYY-MM-DD");

  const receivedOn = clean(body.receivedOn);
  if (receivedOn && !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) errors.push("Received date must be YYYY-MM-DD");

  const currency = clean(body.currency).toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currency)) errors.push("Currency must be a 3-letter code");

  const taxRate = Number(body.taxRate || 0);
  if (!isFinite(taxRate) || taxRate < 0 || taxRate > 100) errors.push("Tax % must be between 0 and 100");

  if (errors.length) return { errors };

  const termDays = Number(body.termDays) || 30;
  const taxAmount = body.taxAmount !== undefined && body.taxAmount !== ""
    ? Number(body.taxAmount)
    : round2((amount * taxRate) / 100);
  // An invoice marked Received needs a date; default it rather than silently
  // dropping the status back to Outstanding.
  const wantsReceived = !!receivedOn || /^received$/i.test(clean(body.status));
  const status = wantsReceived ? "Received" : "Outstanding";
  const settledOn = wantsReceived ? receivedOn || today() : "";

  return {
    invoice: {
      ...existing,
      invoiceNo,
      clientName: clean(body.clientName),
      amount: round2(amount),
      currency,
      paymentMode: clean(body.paymentMode) || "Online",
      raisedOn,
      invoicedMonth: clean(body.invoicedMonth) || monthOf(raisedOn),
      status,
      receivedOn: settledOn,
      dueDate: clean(body.dueDate) || addDays(raisedOn, termDays),
      termDays,
      taxRate,
      taxAmount: round2(taxAmount),
      amountReceived: status === "Received"
        ? round2(Number(body.amountReceived) > 0 ? Number(body.amountReceived) : amount - taxAmount)
        : 0,
      remarks: clean(body.remarks)
    }
  };
}

export function normalizeClient(body) {
  const name = clean(body.name);
  if (!name) throw Object.assign(new Error("Client name is required"), { status: 400 });
  return {
    name,
    fullName: clean(body.fullName),
    email: clean(body.email),
    currency: clean(body.currency).toUpperCase(),
    termDays: Number(body.termDays) || 30,
    taxRate: Number(body.taxRate) || 0,
    notes: clean(body.notes)
  };
}

// --- the mutations, shared by both builds ------------------------------------
// Each takes the full dataset and edits it in place. The caller handles IO.

export const mutations = {
  createInvoice(data, body) {
    const { errors, invoice } = validateInvoice(body);
    if (errors) throw Object.assign(new Error(errors.join(" · ")), { status: 400, errors });
    if (data.invoices.some((i) => i.invoiceNo.toLowerCase() === invoice.invoiceNo.toLowerCase())) {
      throw Object.assign(new Error(`Invoice ${invoice.invoiceNo} already exists`), { status: 409 });
    }
    data.invoices.push(invoice);
    if (!data.clients.some((c) => c.name.toLowerCase() === invoice.clientName.toLowerCase())) {
      data.clients.push({
        name: invoice.clientName, fullName: "", email: "",
        currency: invoice.currency, termDays: invoice.termDays, taxRate: 0, notes: ""
      });
    }
  },

  updateInvoice(data, body, no) {
    const idx = data.invoices.findIndex((i) => i.invoiceNo.toLowerCase() === no.toLowerCase());
    if (idx < 0) throw Object.assign(new Error("Invoice not found"), { status: 404 });
    const { errors, invoice } = validateInvoice(body, data.invoices[idx]);
    if (errors) throw Object.assign(new Error(errors.join(" · ")), { status: 400, errors });
    data.invoices[idx] = invoice;
  },

  deleteInvoice(data, _body, no) {
    const before = data.invoices.length;
    data.invoices = data.invoices.filter((i) => i.invoiceNo.toLowerCase() !== no.toLowerCase());
    if (data.invoices.length === before) throw Object.assign(new Error("Invoice not found"), { status: 404 });
  },

  saveClient(data, body) {
    const next = normalizeClient(body);
    const target = (clean(body.originalName) || next.name).toLowerCase();
    const idx = data.clients.findIndex((c) => c.name.toLowerCase() === target);
    if (idx < 0) return void data.clients.push(next);
    const previous = data.clients[idx].name;
    data.clients[idx] = next;
    // Renaming a client has to follow its invoices, or the ledger orphans them.
    if (previous !== next.name) {
      for (const inv of data.invoices) if (inv.clientName === previous) inv.clientName = next.name;
    }
  },

  saveSettings(data, body) {
    data.settings = {
      ...data.settings,
      ...body,
      rates: { ...data.settings.rates, ...(body.rates || {}) }
    };
    data.settings.rates[data.settings.baseCurrency] = 1;
  }
};
