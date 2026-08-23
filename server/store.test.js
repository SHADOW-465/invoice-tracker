// Round-trip self-check for the Excel store: what goes into the workbook must come
// back out identical, and a legacy hand-kept sheet must still parse.
// Run with `npm test`. Uses a throwaway file, never the real ledger.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import XLSX from "xlsx";

const tmp = path.join(os.tmpdir(), `financeos-test-${Date.now()}.xlsx`);
process.env.LEDGER_FILE = tmp;
const { readAll, writeAll, addDays, monthOf } = await import("./store.js");

const invoice = {
  invoiceNo: "SnS02540",
  clientName: "Vantage Labs",
  amount: 3381.95,
  currency: "USD",
  paymentMode: "Online",
  raisedOn: "2026-01-12",
  invoicedMonth: "January",
  status: "Received",
  receivedOn: "2026-02-20",
  dueDate: "2026-02-11",
  termDays: 30,
  taxRate: 15,
  taxAmount: 507.29,
  amountReceived: 2874.66,
  remarks: "Received payment after 15% tax deduction"
};

const settings = {
  workspaceName: "Sengupta & Sons",
  baseCurrency: "INR",
  invoicePrefix: "SnS",
  defaultTermDays: 30,
  bankDetails: "Bank line one",
  rates: { INR: 1, USD: 87.4 }
};

const client = { name: "Vantage Labs", fullName: "Vantage Labs Pvt", email: "ap@vantage.example", currency: "USD", termDays: 45, taxRate: 15, notes: "Withholds TDS" };

writeAll({ invoices: [invoice], clients: [client], settings });
const back = readAll();

assert.equal(back.invoices.length, 1, "one invoice survives the round trip");
for (const key of Object.keys(invoice)) {
  assert.deepEqual(back.invoices[0][key], invoice[key], `invoice.${key} round-trips`);
}
assert.equal(back.clients[0].termDays, 45, "client defaults round-trip");
assert.equal(back.settings.workspaceName, "Sengupta & Sons", "settings round-trip");
assert.equal(back.settings.rates.USD, 87.4, "exchange rates round-trip");

// Dates must not drift a day through the Excel serial conversion, in any timezone.
assert.equal(back.invoices[0].raisedOn, "2026-01-12", "raised date holds");
assert.equal(back.invoices[0].receivedOn, "2026-02-20", "received date holds");

// Dates must land on whole Excel serials, or Excel shows a time component and any
// formula in the sheet inherits the fraction.
const written = XLSX.utils.sheet_to_json(XLSX.readFile(tmp).Sheets["Invoices"])[0];
assert.equal(written["Raised on"] % 1, 0, "raised date is a whole day serial");
assert.equal(written["Received on"] % 1, 0, "received date is a whole day serial");

// A legacy sheet: original headers, Excel date serials, tax only mentioned in remarks.
const legacy = XLSX.utils.json_to_sheet([
  {
    "Invoice \n#": "SnS02532",
    "Client Name": "V",
    "Actual Invoiced Amt": 3381.95,
    "Mode of Payment": "Online",
    "UOM": "USD",
    "Raised on": 46034,
    "Invoiced \nMonth": "January",
    "Collection \nStatus": "Received",
    "Received on": 46073,
    "Due by\n(days)": "-",
    "Remarks": "Received payment after 15% tax deduction"
  },
  {
    "Invoice \n#": "SnS02555",
    "Client Name": "A",
    "Actual Invoiced Amt": 6120,
    "UOM": "USD",
    "Raised on": 46239,
    "Collection \nStatus": "Pending",
    "Received on": "",
    "Remarks": ""
  }
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, legacy, "Sheet1");
XLSX.writeFile(wb, tmp);

const parsed = readAll();
assert.equal(parsed.invoices.length, 2, "legacy rows parse");
const [paid, open] = parsed.invoices;
assert.equal(paid.raisedOn, "2026-01-12", "excel serial becomes an ISO date");
assert.equal(paid.status, "Received", "a received date implies Received");
assert.equal(paid.taxRate, 15, "withholding is recovered from the remarks text");
assert.equal(paid.taxAmount, 507.29, "withholding amount is computed");
assert.equal(paid.amountReceived, 2874.66, "net received is derived");
assert.equal(open.status, "Outstanding", "an unpaid row is Outstanding");
assert.equal(open.dueDate, addDays(open.raisedOn, 30), "due date defaults to Net 30");
assert.equal(open.invoicedMonth, monthOf(open.raisedOn), "invoiced month is derived");
assert.equal(parsed.clients.length, 2, "clients are inferred from invoices");

// Saving a legacy workbook must not lose the first sheet's rows.
writeAll(parsed);
assert.equal(readAll().invoices.length, 2, "legacy workbook survives a save");

// Marking an invoice Received by hand must produce a real receipt: a date, and the
// expected net rather than a zero that would quietly understate collections.
const { validateInvoice } = await import("../src/lib/workbook.js");
const marked = validateInvoice({
  invoiceNo: "X1", clientName: "C", amount: 1000, currency: "USD",
  raisedOn: "2026-05-01", status: "Received", taxRate: 15, amountReceived: 0
}).invoice;
assert.equal(marked.status, "Received", "the status the user chose is honoured");
assert.ok(marked.receivedOn, "a received date is filled in rather than left blank");
assert.equal(marked.amountReceived, 850, "a zero receipt falls back to the expected net");

const reverted = validateInvoice({
  invoiceNo: "X1", clientName: "C", amount: 1000, currency: "USD",
  raisedOn: "2026-05-01", status: "Outstanding", receivedOn: "", amountReceived: 850
}).invoice;
assert.equal(reverted.status, "Outstanding", "reverting to Outstanding sticks");
assert.equal(reverted.receivedOn, "", "reverting clears the receipt date");
assert.equal(reverted.amountReceived, 0, "reverting clears the received amount");

// "Today" must be the local calendar day. Deriving it from UTC dates receipts a day
// early anywhere east of Greenwich for the first hours of the morning.
const { today: localToday } = await import("../src/lib/workbook.js");
const now = new Date();
assert.equal(
  localToday(),
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  "today() follows the local calendar, not UTC"
);

// Currency conversion: switching the display currency must re-express every figure
// through the workbook's base, never drop rows.
const { decorate, totals, convert } = await import("../src/lib/derive.js");
const rates = { INR: 1, USD: 87.4, GBP: 111.2 };

assert.equal(convert(100, "USD", "INR", rates), 8740, "USD → INR uses the quoted rate");
assert.equal(round(convert(8740, "INR", "USD", rates)), 100, "INR → USD is the exact inverse");
assert.equal(round(convert(100, "USD", "GBP", rates)), round((100 * 87.4) / 111.2), "cross rate pivots through base");
assert.equal(convert(50, "USD", "USD", rates), 50, "same currency is a no-op");

const mixed = [
  { invoiceNo: "A1", clientName: "A", amount: 100, currency: "USD", raisedOn: "2026-01-01", dueDate: "2026-01-31", receivedOn: "2026-01-20", status: "Received", amountReceived: 100, taxAmount: 0, taxRate: 0, termDays: 30, remarks: "", invoicedMonth: "January", paymentMode: "Online" },
  { invoiceNo: "A2", clientName: "B", amount: 200, currency: "GBP", raisedOn: "2026-01-01", dueDate: "2026-01-31", receivedOn: "", status: "Outstanding", amountReceived: 0, taxAmount: 0, taxRate: 0, termDays: 30, remarks: "", invoicedMonth: "January", paymentMode: "Online" }
];
const inInr = totals(decorate(mixed, rates, "INR"));
const inUsd = totals(decorate(mixed, rates, "USD"));
assert.equal(decorate(mixed, rates, "USD").length, 2, "switching display currency keeps every invoice");
assert.equal(round(inInr.invoiced), round(100 * 87.4 + 200 * 111.2), "totals convert into INR");
assert.equal(round(inUsd.invoiced), round(inInr.invoiced / 87.4), "the same totals re-expressed in USD");
assert.equal(round(inInr.collectionRate), round(inUsd.collectionRate), "ratios are currency-independent");

function round(n) { return Math.round(n * 100) / 100; }

fs.rmSync(tmp, { force: true });
fs.rmSync(path.join(os.tmpdir(), "backups"), { recursive: true, force: true });
console.log("store: all checks passed");
