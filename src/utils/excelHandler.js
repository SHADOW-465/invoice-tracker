// Excel & CSV Import/Export Handler using SheetJS
import * as XLSX from "xlsx";
import { toISODate, getMonthName, calculateAging } from "./calculations";

/**
 * Export invoice list to an Excel (.xlsx) file matching the exact layout of Invoice Tracker.xlsx
 */
export function exportToExcel(invoices, filename = "Invoice_Tracker_Export.xlsx") {
  const rows = invoices.map(inv => {
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
      "Remarks": inv.remarks || ""
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for clean readability
  worksheet["!cols"] = [
    { wch: 14 }, // Invoice #
    { wch: 18 }, // Client Name
    { wch: 22 }, // Actual Invoiced Amt
    { wch: 18 }, // Mode of Payment
    { wch: 8 },  // UOM
    { wch: 14 }, // Raised on
    { wch: 16 }, // Invoiced Month
    { wch: 18 }, // Collection Status
    { wch: 14 }, // Received on
    { wch: 16 }, // Due by (days)
    { wch: 45 }  // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  XLSX.writeFile(workbook, filename);
}

/**
 * Parse an uploaded Excel / CSV File into Invoice objects
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        const parsedInvoices = rawJson.map((row, idx) => {
          // Normalize column keys
          const invoiceNo = row["Invoice #"] || row["Invoice No"] || row["Invoice"] || row["Invoice \n#"] || `INV-${Date.now()}-${idx}`;
          const clientName = row["Client Name"] || row["Client"] || "Unnamed Client";
          const amount = parseFloat(row["Actual Invoiced Amt"] || row["Amount"] || row["Invoiced Amt"] || 0);
          const paymentMode = row["Mode of Payment"] || row["Payment Mode"] || "Online";
          const currency = (row["UOM"] || row["Currency"] || "USD").toString().trim().toUpperCase();
          
          let raisedOn = row["Raised on"] || row["Raised Date"] || row["Date"] || "";
          if (raisedOn instanceof Date) {
            raisedOn = toISODate(raisedOn);
          } else if (typeof raisedOn === "string") {
            raisedOn = toISODate(raisedOn);
          }

          let receivedOn = row["Received on"] || row["Received Date"] || "";
          if (receivedOn instanceof Date) {
            receivedOn = toISODate(receivedOn);
          } else if (typeof receivedOn === "string" && receivedOn.trim() !== "-") {
            receivedOn = toISODate(receivedOn);
          } else {
            receivedOn = "";
          }

          const invoicedMonth = row["Invoiced Month"] || row["Invoiced \nMonth"] || (raisedOn ? getMonthName(raisedOn) : "January");
          const status = row["Collection Status"] || row["Collection \nStatus"] || row["Status"] || (receivedOn ? "Received" : "Pending");
          const remarks = row["Remarks"] || row["Notes"] || "";

          // Check if remarks mention tax deduction
          let taxRate = 0;
          let taxAmount = 0;
          let netReceived = amount;

          if (remarks.toLowerCase().includes("15% tax") || remarks.toLowerCase().includes("15%")) {
            taxRate = 15;
            taxAmount = parseFloat(((amount * 15) / 100).toFixed(2));
            netReceived = parseFloat((amount - taxAmount).toFixed(2));
          } else if (status === "Received") {
            netReceived = amount;
          }

          return {
            id: `inv-import-${Date.now()}-${idx}`,
            invoiceNo: String(invoiceNo).trim(),
            clientName: String(clientName).trim(),
            amount: isNaN(amount) ? 0 : amount,
            currency: currency || "USD",
            paymentMode: String(paymentMode).trim(),
            raisedOn: raisedOn || toISODate(new Date()),
            invoicedMonth: String(invoicedMonth).trim(),
            status: String(status).trim(),
            receivedOn: receivedOn || "",
            paymentTerms: "Net 30",
            dueDate: raisedOn ? toISODate(new Date(new Date(raisedOn).getTime() + 30 * 86400000)) : "",
            taxRate,
            taxAmount,
            netReceived,
            remarks: String(remarks).trim()
          };
        });

        resolve(parsedInvoices);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
