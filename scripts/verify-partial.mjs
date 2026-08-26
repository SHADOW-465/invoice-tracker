import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifyDir = path.join(root, ".verify");

function rewrite(srcRel, destRel, replacements) {
  let s = fs.readFileSync(path.join(root, srcRel), "utf8");
  for (const [from, to] of replacements) s = s.split(from).join(to);
  const dest = path.join(verifyDir, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, s);
}

fs.rmSync(verifyDir, { recursive: true, force: true });
rewrite("src/types/finance.js", "types/finance.js", []);
rewrite("src/utils/calculations.js", "utils/calculations.js", [
  ['from "../types/finance"', 'from "../types/finance.js"']
]);
rewrite("src/utils/excelHandler.js", "utils/excelHandler.js", [
  ['from "./calculations"', 'from "./calculations.js"']
]);

const { parseWorkbook, exportToExcel } = await import(
  pathToFileUrl(path.join(verifyDir, "utils/excelHandler.js"))
);
const { calculateFinancialMetrics, getBalanceDue, isPartiallyPaid } = await import(
  pathToFileUrl(path.join(verifyDir, "utils/calculations.js"))
);

function pathToFileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, "/");
  return abs.startsWith("/") ? `file://${abs}` : `file:///${abs}`;
}

function summarize(label, invoices, clients) {
  const metrics = calculateFinancialMetrics(invoices, "USD");
  const partials = invoices.filter((i) => isPartiallyPaid(i.status));
  const collected = metrics.totalReceivedBase;
  const invoiced = metrics.totalInvoicedBase;
  const ok = collected <= invoiced + 0.02;
  const contacts = (clients || []).filter((c) => c.contactPerson || c.email);
  console.log(`\n=== ${label} ===`);
  console.log(`rows=${invoices.length} partials=${partials.length} contacts=${contacts.length}`);
  console.log(`invoiced=${invoiced.toFixed(2)} collected=${collected.toFixed(2)} pending=${metrics.totalPendingBase.toFixed(2)} overdue=${metrics.totalOverdueBase.toFixed(2)}`);
  console.log(`collected <= invoiced: ${ok ? "PASS" : "FAIL"}`);
  if (partials.length) {
    console.log("partial samples:", partials.slice(0, 3).map((i) => ({
      no: i.invoiceNo, amt: i.amount, net: i.netReceived, due: getBalanceDue(i), status: i.status
    })));
  }
  return ok;
}

const files = [
  "Revenue & Pipeline_Simon and Sons_2529_3.xlsx",
  "Revenue & Pipeline_Simon and Sons_2530 Onwards_3.xlsx"
];

let failed = 0;
for (const name of files) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) {
    console.log(`MISSING ${name}`);
    failed += 1;
    continue;
  }
  const wb = XLSX.readFile(p, { cellDates: true });
  const result = parseWorkbook(wb);
  if (!summarize(name, result.parsedInvoices, result.parsedClients)) failed += 1;
}

// Round-trip: a genuine partial must survive export then re-import.
const synthetic = [
  {
    invoiceNo: "SnS-PARTIAL-1",
    clientName: "Acme",
    amount: 1000,
    currency: "USD",
    paymentMode: "Online",
    raisedOn: "2026-01-15",
    invoicedMonth: "January",
    status: "Partially Paid",
    receivedOn: "2026-02-01",
    paymentTerms: "Net 30",
    dueDate: "2026-02-14",
    taxRate: 0,
    taxAmount: 0,
    netReceived: 400,
    remarks: "First installment"
  },
  {
    invoiceNo: "SnS-FULL-1",
    clientName: "Acme",
    amount: 250,
    currency: "USD",
    paymentMode: "Online",
    raisedOn: "2026-01-20",
    invoicedMonth: "January",
    status: "Received",
    receivedOn: "2026-02-05",
    paymentTerms: "Net 30",
    dueDate: "2026-02-19",
    taxRate: 10,
    taxAmount: 25,
    netReceived: 225,
    remarks: ""
  }
];

const tmpXlsx = path.join(verifyDir, "roundtrip.xlsx");
const origCwd = process.cwd();
process.chdir(verifyDir);
exportToExcel(synthetic, "roundtrip.xlsx");
process.chdir(origCwd);

const reimported = parseWorkbook(XLSX.readFile(tmpXlsx, { cellDates: true }));
const partial = reimported.parsedInvoices.find((i) => i.invoiceNo === "SnS-PARTIAL-1");
const full = reimported.parsedInvoices.find((i) => i.invoiceNo === "SnS-FULL-1");
console.log("\n=== round-trip ===");
console.log("partial", partial && { status: partial.status, net: partial.netReceived, receivedOn: partial.receivedOn });
console.log("full", full && { status: full.status, net: full.netReceived });

const roundTripOk =
  partial &&
  partial.status === "Partially Paid" &&
  Number(partial.netReceived) === 400 &&
  full &&
  full.status === "Received" &&
  Math.abs(Number(full.netReceived) - 225) < 0.02;

console.log(`round-trip: ${roundTripOk ? "PASS" : "FAIL"}`);
if (!roundTripOk) failed += 1;

const metrics = calculateFinancialMetrics(synthetic, "USD");
const balanceOk = getBalanceDue(synthetic[0]) === 600;
const collectedOk = metrics.totalReceivedBase <= metrics.totalInvoicedBase + 0.02;
console.log(`balance due 600: ${balanceOk ? "PASS" : "FAIL"} (got ${getBalanceDue(synthetic[0])})`);
console.log(`synthetic collected <= invoiced: ${collectedOk ? "PASS" : "FAIL"}`);
if (!balanceOk || !collectedOk) failed += 1;

fs.rmSync(verifyDir, { recursive: true, force: true });

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
