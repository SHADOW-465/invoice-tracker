import jsPDF from "jspdf";
import { fmtLong, money } from "./format";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(rows, filename) {
  if (!rows.length) throw new Error("Nothing to export in this view");
  const headers = Object.keys(rows[0]);
  const csv = [headers, ...rows.map((r) => headers.map((h) => r[h]))]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), filename);
}

export const invoiceRowsForExport = (list, base) =>
  list.map((i) => ({
    "Invoice #": i.invoiceNo,
    "Client": i.clientName,
    "Amount": i.amount,
    "Currency": i.currency,
    [`Amount (${base})`]: Math.round(i.base * 100) / 100,
    "Raised on": i.raisedOn,
    "Due date": i.dueDate,
    "Status": i.status,
    "Received on": i.receivedOn,
    "Amount received": i.receivedAmount || "",
    "Tax %": i.taxRate || 0,
    "Tax amount": i.taxAmount || 0,
    "Days overdue": i.overdueDays || "",
    "Days to collect": i.daysToCollect ?? "",
    "Payment method": i.paymentMode,
    "Remarks": i.remarks
  }));

/** Single-page A4 invoice document. Quiet, printable, no colour drama. */
export function invoicePdf(invoice, settings) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = 48, R = 547;
  const ink = [20, 22, 26], muted = [95, 95, 89], line = [219, 219, 213];
  let y = 64;

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...ink);
  doc.text(settings.workspaceName || "Invoice", L, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  const addr = String(settings.workspaceAddress || "").split("\n").filter(Boolean);
  let ay = y + 16;
  for (const a of addr) { doc.text(a, L, ay); ay += 12; }
  if (settings.workspaceEmail) { doc.text(settings.workspaceEmail, L, ay); ay += 12; }
  if (settings.taxId) { doc.text(`Tax ID: ${settings.taxId}`, L, ay); ay += 12; }

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...ink);
  doc.text("INVOICE", R, y, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  doc.text(invoice.invoiceNo, R, y + 16, { align: "right" });
  doc.text(`Raised ${fmtLong(invoice.raisedOn)}`, R, y + 30, { align: "right" });
  doc.text(`Due ${fmtLong(invoice.dueDate)}`, R, y + 44, { align: "right" });
  doc.text(invoice.status.toUpperCase(), R, y + 58, { align: "right" });

  y = Math.max(ay, y + 72) + 14;
  doc.setDrawColor(...line).setLineWidth(0.8).line(L, y, R, y);

  y += 26;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...muted).text("BILLED TO", L, y);
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...ink).text(invoice.clientName, L, y + 18);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...muted);
  doc.text(`Payment method: ${invoice.paymentMode}  ·  Terms: Net ${invoice.termDays || 30}`, L, y + 34);

  y += 66;
  doc.setFillColor(246, 246, 244).rect(L, y, R - L, 26, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...muted);
  doc.text("DESCRIPTION", L + 12, y + 17);
  doc.text("CURRENCY", 360, y + 17);
  doc.text("AMOUNT", R - 12, y + 17, { align: "right" });

  y += 46;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...ink);
  doc.text(`Professional services — invoice ${invoice.invoiceNo}`, L + 12, y);
  doc.text(invoice.currency, 360, y);
  doc.text(money(invoice.amount, invoice.currency), R - 12, y, { align: "right" });

  y += 18;
  doc.setDrawColor(...line).line(L, y, R, y);

  const put = (label, value, bold) => {
    y += 20;
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(10);
    doc.setTextColor(...(bold ? ink : muted));
    doc.text(label, 380, y);
    doc.setTextColor(...ink).text(value, R - 12, y, { align: "right" });
  };
  put("Subtotal", money(invoice.amount, invoice.currency));
  if (invoice.taxAmount > 0) {
    put(`Withholding (${invoice.taxRate}%)`, `-${money(invoice.taxAmount, invoice.currency)}`);
    put("Net expected", money(invoice.amount - invoice.taxAmount, invoice.currency), true);
  } else {
    put("Total due", money(invoice.amount, invoice.currency), true);
  }
  if (invoice.status === "Received") {
    put("Received", money(invoice.receivedAmount, invoice.currency));
    put("Balance", money(invoice.amount - invoice.taxAmount - invoice.receivedAmount, invoice.currency), true);
  }

  y += 40;
  doc.setDrawColor(...line).line(L, y, R, y);
  y += 22;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...muted).text("PAYMENT INSTRUCTIONS", L, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const body = [invoice.remarks ? `Notes: ${invoice.remarks}` : "", settings.bankDetails || ""]
    .filter(Boolean).join("\n\n");
  doc.text(doc.splitTextToSize(body || "—", R - L), L, y + 16);

  doc.save(`${invoice.invoiceNo} — ${invoice.clientName}.pdf`);
}

/** Reminder email text, ready to paste into the mail client. */
export function reminderText(invoice, settings) {
  const state = invoice.status === "Received"
    ? "settled"
    : invoice.overdueDays > 0
    ? `overdue by ${invoice.overdueDays} days`
    : `due on ${fmtLong(invoice.dueDate)}`;
  const subject = `${invoice.overdueDays > 0 ? "Overdue: " : ""}Invoice ${invoice.invoiceNo} — ${settings.workspaceName || ""}`.trim();
  const body = [
    `Hello ${invoice.clientName},`,
    ``,
    `A quick note about invoice ${invoice.invoiceNo} for ${money(invoice.amount, invoice.currency)}, raised on ${fmtLong(invoice.raisedOn)}. It is currently ${state}.`,
    ``,
    settings.bankDetails ? `Payment details:\n${settings.bankDetails}` : "",
    ``,
    `Please let us know once the remittance is on its way, or if anything is holding it up.`,
    ``,
    `Thanks,`,
    settings.workspaceName || "",
    settings.workspaceEmail || ""
  ].filter((l) => l !== undefined).join("\n");
  return { subject, body };
}
