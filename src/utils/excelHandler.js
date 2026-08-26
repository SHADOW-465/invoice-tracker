// Excel & CSV Import/Export Handler using SheetJS
import * as XLSX from "xlsx";
import { toISODate, getMonthName, calculateAging, getEffectiveStatus } from "./calculations";

const cleanKey = (k) => String(k || "").replace(/\s+/g, " ").trim().toLowerCase();

const pickVal = (row, ...keys) => {
  const rowKeys = Object.keys(row || {});
  for (const target of keys) {
    const targetClean = cleanKey(target);
    const found = rowKeys.find((k) => cleanKey(k) === targetClean);
    if (found !== undefined && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
      return row[found];
    }
  }
  return "";
};

/**
 * Map whatever a spreadsheet calls a status onto the vocabulary this app uses.
 * A received date always wins - if cash landed, the invoice is settled regardless
 * of what the status column says.
 */
function normaliseStatus(rawStatus, receivedOn) {
  const v = String(rawStatus || "").trim().toLowerCase();
  if (receivedOn) return "Received";
  if (/^(received|paid|settled|complete[d]?|closed)$/.test(v)) return "Received";
  if (/^(cancel|cancelled|canceled|void|voided|written off|write[- ]off)$/.test(v)) return "Cancelled";
  if (/^(duplicate|dupe|repeated)$/.test(v)) return "Duplicate";
  if (/^(suspend|suspended|on hold|hold|paused|parked)$/.test(v)) return "Suspended";
  if (/^(draft|unissued|proforma|pro[- ]forma)$/.test(v)) return "Draft";
  if (/^(overdue|late|past due)$/.test(v)) return "Overdue";
  return "Pending";
}

/**
 * Spreadsheets rarely hold clean ISO codes. Map the labels this business actually
 * uses; anything still unrecognised is passed through untouched so it shows up in
 * Settings as needing a rate rather than being silently converted 1:1.
 */
const CURRENCY_ALIASES = {
  RAND: "ZAR", "SA RAND": "ZAR", R: "ZAR",
  "US DOLLAR": "USD", USD$: "USD", DOLLAR: "USD", $: "USD",
  POUND: "GBP", GBP$: "GBP", STERLING: "GBP", "£": "GBP",
  EURO: "EUR", "€": "EUR",
  RUPEE: "INR", RS: "INR", "₹": "INR", INR$: "INR",
  DIRHAM: "AED",
  "NZ DOLLAR": "NZD", "AU DOLLAR": "AUD", "AUS": "AUD",
  "CAN DOLLAR": "CAD",
  "SING DOLLAR": "SGD"
};

function normaliseCurrency(raw) {
  const v = String(raw || "").trim().toUpperCase();
  if (!v) return "";
  return CURRENCY_ALIASES[v] || v;
}

export function exportToExcel(invoices, filename = "Invoice_Tracker_Export.xlsx") {
  const rows = (invoices || []).map((inv) => {
    const aging = calculateAging(inv);
    const dueByDaysVal = inv.status === "Received" ? "-" : aging.daysOutstanding;

    return {
      "Invoice #": inv.invoiceNo || "",
      "Client Name": inv.clientName || "",
      "Actual Invoiced Amt": Number(inv.amount || 0),
      "Mode of Payment": inv.paymentMode || "Online",
      "UOM": inv.currency || "USD",
      "Raised on": inv.raisedOn || "",
      "Invoiced Month": inv.invoicedMonth || (inv.raisedOn ? getMonthName(inv.raisedOn) : ""),
      "Collection Status": inv.status || "Pending",
      "Received on": inv.receivedOn || "",
      "Due by (days)": dueByDaysVal,
      "Remarks": inv.remarks || "",
      // Appended columns - recoverable on re-import.
      "Due Date": inv.dueDate || "",
      "Payment Terms": inv.paymentTerms || "Net 30",
      "Tax %": Number(inv.taxRate || 0),
      "Tax Amount": Number(inv.taxAmount || 0),
      "Net Received": inv.status === "Received" ? Number(inv.netReceived || 0) : "",
      "Effective Status": getEffectiveStatus(inv),
      "Days Overdue": aging.isOverdue ? aging.overdueDays : ""
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 8 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 45 },
    { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename);
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });

        // Find the best sheet (first sheet, or sheet named Invoices / Revenue / 2026, or the one with most rows)
        let chosenSheetName = workbook.SheetNames[0];
        let maxRows = 0;
        let chosenWorksheet = workbook.Sheets[chosenSheetName];

        for (const sName of workbook.SheetNames) {
          const ws = workbook.Sheets[sName];
          const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (json.length > maxRows) {
            maxRows = json.length;
            chosenSheetName = sName;
            chosenWorksheet = ws;
          }
        }

        const rawJson = XLSX.utils.sheet_to_json(chosenWorksheet, { defval: "" });

        const parsedInvoices = rawJson
          .map((row, idx) => {
            const rawInvNo = pickVal(row, "Invoice #", "Invoice No", "Invoice No.", "Invoice", "Inv #", "Inv No", "Bill No", "Doc No", "Reference", "Doc #", "Number");
            const rawClient = pickVal(row, "Client Name", "Client", "Customer", "Company", "Account", "Party Name", "Billed To", "Name", "Client/Customer");
            const rawAmt = pickVal(row, "Actual Invoiced Amt", "Amount", "Invoiced Amt", "Total", "Invoice Amount", "Net Amount", "Gross Amount", "Value", "Bill Amount", "Price");
            const numAmt = parseFloat(String(rawAmt).replace(/[^0-9.-]/g, "")) || 0;

            // Discard empty/phantom placeholder rows (no client and 0 amount)
            if (!rawClient && numAmt === 0) return null;
            if (!rawInvNo && !rawClient) return null;

            const invoiceNo = String(rawInvNo || `INV-${Date.now()}-${idx + 1}`).trim();
            const clientName = String(rawClient || "Direct Client").trim();
            const paymentMode = String(pickVal(row, "Mode of Payment", "Payment Mode", "Payment Method", "Method", "Type", "Channel") || "Online").trim();
            const currency = normaliseCurrency(pickVal(row, "UOM", "Currency", "Curr", "Unit", "Currency Code"));

            let raisedOn = pickVal(row, "Raised on", "Raised Date", "Invoice Date", "Date", "Bill Date", "Issue Date", "Dated", "Created");
            if (raisedOn instanceof Date) raisedOn = toISODate(raisedOn);
            else if (typeof raisedOn === "string") raisedOn = toISODate(raisedOn);

            let receivedOn = pickVal(row, "Received on", "Received Date", "Paid Date", "Payment Date", "Settled on", "Date Paid");
            if (receivedOn instanceof Date) receivedOn = toISODate(receivedOn);
            else if (typeof receivedOn === "string" && receivedOn.trim() !== "-") receivedOn = toISODate(receivedOn);
            else receivedOn = "";

            const invoicedMonth = String(pickVal(row, "Invoiced Month", "Month") || (raisedOn ? getMonthName(raisedOn) : "January")).trim();
            const rawStatus = String(
              pickVal(row, "Collection Status", "Status", "Payment Status", "State", "Invoice Status") || ""
            ).trim();
            const status = normaliseStatus(rawStatus, receivedOn);
            const remarks = String(pickVal(row, "Remarks", "Notes", "Description", "Memo", "Comments", "Details") || "").trim();

            let taxRate = 0;
            const declaredTax = pickVal(row, "Tax %", "Tax Rate", "TDS %", "TDS Rate", "Withholding %");
            if (declaredTax !== "") {
              taxRate = parseFloat(String(declaredTax).replace(/[^0-9.-]/g, "")) || 0;
            } else {
              const taxMatch = /(\d+(?:\.\d+)?)\s*%/.exec(remarks);
              if (taxMatch) taxRate = parseFloat(taxMatch[1]);
            }

            const declaredTaxAmt = pickVal(row, "Tax Amount", "TDS Amount", "Withholding Amount");
            const taxAmount = declaredTaxAmt !== ""
              ? (parseFloat(String(declaredTaxAmt).replace(/[^0-9.-]/g, "")) || 0)
              : (taxRate ? parseFloat(((numAmt * taxRate) / 100).toFixed(2)) : 0);

            const declaredNet = pickVal(row, "Net Received", "Amount Received", "Received Amount");
            const netReceived = status === "Received"
              ? (declaredNet !== ""
                ? (parseFloat(String(declaredNet).replace(/[^0-9.-]/g, "")) || 0)
                : parseFloat((numAmt - taxAmount).toFixed(2)))
              : 0;

            // Honour an explicit due date / terms column instead of always assuming Net 30.
            let dueDate = pickVal(row, "Due Date", "Due on", "Payment Due");
            if (dueDate instanceof Date) dueDate = toISODate(dueDate);
            else if (typeof dueDate === "string" && dueDate.trim()) dueDate = toISODate(dueDate);
            else dueDate = "";

            const termsRaw = String(pickVal(row, "Payment Terms", "Terms") || "").trim();
            const termDays = /(\d+)/.exec(termsRaw) ? Number(/(\d+)/.exec(termsRaw)[1]) : 30;

            return {
              id: `inv-import-${Date.now()}-${idx}`,
              invoiceNo,
              clientName,
              amount: numAmt,
              currency: currency || "UNKNOWN",
              paymentMode: paymentMode || "Online",
              raisedOn: raisedOn || toISODate(new Date()),
              invoicedMonth: invoicedMonth || "January",
              status,
              receivedOn: receivedOn || "",
              paymentTerms: termsRaw || `Net ${termDays}`,
              dueDate: dueDate || (raisedOn ? toISODate(new Date(new Date(raisedOn).getTime() + termDays * 86400000)) : ""),
              taxRate,
              taxAmount,
              netReceived,
              remarks
            };
          })
          .filter(Boolean);

        resolve({
          parsedInvoices,
          sheetName: chosenSheetName,
          totalRows: parsedInvoices.length,
          fileName: file.name
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
