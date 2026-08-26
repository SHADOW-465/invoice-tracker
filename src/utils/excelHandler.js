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
 * An explicit partial status wins over a received date, because a partial
 * payment also has a received date and must not be treated as fully settled.
 */
function normaliseStatus(rawStatus, receivedOn) {
  const v = String(rawStatus || "").trim().toLowerCase();
  // Partial payments also carry a received date, so that date must not
  // silently promote them to fully Received on re-import.
  if (/partial/.test(v)) return "Partially Paid";
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
  RAND: "ZAR", "SA RAND": "ZAR", R: "ZAR", "ZAR ": "ZAR",
  "US DOLLAR": "USD", USD$: "USD", DOLLAR: "USD", $: "USD", "USD ": "USD",
  POUND: "GBP", GBP$: "GBP", STERLING: "GBP", "£": "GBP", "GBP ": "GBP",
  EURO: "EUR", "€": "EUR", "EUR ": "EUR",
  RUPEE: "INR", RS: "INR", "₹": "INR", INR$: "INR", "INR ": "INR",
  DIRHAM: "AED", "UAE DIRHAM": "AED", DHS: "AED", "AED ": "AED",
  RIYAL: "SAR", "SAUDI RIYAL": "SAR", "SAR ": "SAR",
  "NZ DOLLAR": "NZD", "NZD ": "NZD",
  "AU DOLLAR": "AUD", "AUS": "AUD", "AUD ": "AUD",
  "CAN DOLLAR": "CAD", "CAD ": "CAD",
  "SING DOLLAR": "SGD", "SGD ": "SGD",
  PESO: "MXN", "MEXICAN PESO": "MXN", "MEX$": "MXN", "MXN ": "MXN",
  YEN: "JPY", "JAPANESE YEN": "JPY", "JPY ": "JPY",
  YUAN: "CNY", "CHINESE YUAN": "CNY", RMB: "CNY", "CNY ": "CNY"
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
      "Net Received": (inv.status === "Received" || inv.status === "Partially Paid")
        ? Number(inv.netReceived || 0)
        : "",
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

export function parseWorkbook(workbook) {
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

        // Client contact details live on the invoice rows in the source sheet
        // (Contact Person / Email ID columns) but belong on the client record,
        // not repeated onto every invoice. Collected once here, applied to
        // whichever client each row names, and returned separately so the caller
        // can merge them into the client directory.
        const clientContacts = new Map();
        const noteClientContact = (name, contactPerson, email, currency) => {
          const key = name.trim().toLowerCase();
          if (!key) return;
          const existing = clientContacts.get(key) || { name: name.trim(), contactPerson: "", email: "", defaultCurrency: currency };
          if (contactPerson && !existing.contactPerson) existing.contactPerson = contactPerson;
          if (email && !existing.email) existing.email = email;
          if (!existing.defaultCurrency && currency) existing.defaultCurrency = currency;
          clientContacts.set(key, existing);
        };

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

            // A genuine gap between what was owed and what actually landed is a
            // partial payment, not a full settlement - counting the full amount as
            // collected overstates cash in hand, and dropping to Pending loses the
            // part that DID come in.
            //
            // Only unambiguous column names are trusted for this. A real export
            // proved why: it carried a bare "Received" / "Remaining Amount" pair
            // that looked plausible but actually belonged to an unrelated monthly
            // pivot table bolted onto the same sheet (Month / Targets / Vendor
            // Cost columns), so row 10's invoice for £908.15 sat next to that
            // pivot's row 10 values of 2000 / 500 - completely unrelated numbers,
            // in a different currency, that would have been silently imported as
            // "this invoice only collected 2000 of 908.15, 500 still owed".
            // "Remaining Amount" is not read at all for the same reason: nothing
            // distinguishes a genuine balance-due column from an unrelated one, so
            // the remaining balance is always derived from netReceived instead of
            // trusted from a second, independently-fallible column.
            const declaredNet = pickVal(row, "Net Received", "Amount Received", "Received Amount", "Amount Paid", "Partial Amount");

            let netReceived = 0;
            let finalStatus = status;

            if (status === "Received" || status === "Partially Paid") {
              const owedAfterTax = parseFloat((numAmt - taxAmount).toFixed(2));
              if (declaredNet !== "") {
                const candidateNet = parseFloat(String(declaredNet).replace(/[^0-9.-]/g, "")) || 0;
                // A declared figure outside a sane range for THIS invoice (negative,
                // or wildly larger than what was owed) is not trustworthy as a
                // same-currency, same-invoice amount.
                const isSane = candidateNet >= 0 && candidateNet <= owedAfterTax * 1.05 + 0.01;
                if (isSane) {
                  netReceived = candidateNet;
                } else if (status === "Received") {
                  netReceived = owedAfterTax;
                } else {
                  netReceived = 0;
                }
              } else if (status === "Received") {
                netReceived = owedAfterTax;
              } else {
                // Explicitly partial with no amount column: keep the status,
                // do not invent a full settlement.
                netReceived = 0;
              }

              const remaining = Math.max(0, Math.round((owedAfterTax - netReceived) * 100) / 100);
              if (remaining > 0.01) finalStatus = "Partially Paid";
              else if (netReceived > 0.01) finalStatus = "Received";
            }

            // Honour an explicit due date / terms column instead of always assuming Net 30.
            let dueDate = pickVal(row, "Due Date", "Due on", "Payment Due");
            if (dueDate instanceof Date) dueDate = toISODate(dueDate);
            else if (typeof dueDate === "string" && dueDate.trim()) dueDate = toISODate(dueDate);
            else dueDate = "";

            const termsRaw = String(pickVal(row, "Payment Terms", "Terms") || "").trim();
            const termDays = /(\d+)/.exec(termsRaw) ? Number(/(\d+)/.exec(termsRaw)[1]) : 30;

            const contactPerson = String(
              pickVal(row, "Contact Person", "Contact Name", "Attn", "Attention") || ""
            ).trim();
            const contactEmail = String(
              pickVal(row, "Email ID", "Email", "Contact Email", "Billing Email") || ""
            ).trim();
            if (contactPerson || contactEmail) {
              noteClientContact(clientName, contactPerson, contactEmail, currency);
            }

            return {
              id: `inv-import-${Date.now()}-${idx}`,
              invoiceNo,
              clientName,
              amount: numAmt,
              currency: currency || "UNKNOWN",
              paymentMode: paymentMode || "Online",
              raisedOn: raisedOn || toISODate(new Date()),
              invoicedMonth: invoicedMonth || "January",
              receivedOn: receivedOn || "",
              paymentTerms: termsRaw || `Net ${termDays}`,
              dueDate: dueDate || (raisedOn ? toISODate(new Date(new Date(raisedOn).getTime() + termDays * 86400000)) : ""),
              status: finalStatus,
              taxRate,
              taxAmount,
              netReceived,
              remarks
            };
          })
          .filter(Boolean);

        return {
          parsedInvoices,
          parsedClients: Array.from(clientContacts.values()),
          sheetName: chosenSheetName,
          totalRows: parsedInvoices.length
        };
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        resolve({ ...parseWorkbook(workbook), fileName: file.name });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
