import React, { useState } from "react";
import { X, Download, Mail, Copy, Check, Printer } from "lucide-react";
import jsPDF from "jspdf";
import { formatDate, formatCurrency, calculateAging } from "../utils/calculations";

export function InvoicePreviewModal({
  isOpen,
  onClose,
  invoice,
  settings,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState("preview");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !invoice) return null;

  const aging = calculateAging(invoice);

  // Generate Email Reminder Copy
  const reminderEmailSubject = `${aging.isOverdue ? "URGENT: " : ""}Payment Reminder for Invoice ${invoice.invoiceNo} - ${settings.companyName}`;
  const reminderEmailBody = `Dear ${invoice.clientName} Team,\n\nI hope this message finds you well.\n\nThis is a friendly reminder regarding Invoice ${invoice.invoiceNo} for ${formatCurrency(invoice.amount, invoice.currency)} issued on ${formatDate(invoice.raisedOn)}.\n\nStatus: ${invoice.status === "Received" ? "PAID" : aging.isOverdue ? `OVERDUE by ${aging.overdueDays} days` : `Due on ${formatDate(invoice.dueDate)}`}\nPayment Mode: ${invoice.paymentMode || "Online"}\n\nBank Payment Details:\n${settings.bankDetails || "Please remit as per invoice instructions."}\n\nPlease let us know once payment has been remitted or if you require any additional information.\n\nBest regards,\n${settings.companyName}\n${settings.companyEmail}`;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${reminderEmailSubject}\n\n${reminderEmailBody}`);
    setCopied(true);
    onShowToast("Copied payment reminder email to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        unit: "pt",
        format: "a4"
      });

      // Colors
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 595, 842, "F");

      // Company Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(4, 120, 87); // emerald
      doc.text(settings.companyName || "Invoice Tracker", 40, 55);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(settings.companyAddress || "New York, USA", 40, 72);
      doc.text(settings.companyEmail || "billing@snsglobal.com", 40, 86);

      // Invoice Title & Info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(30, 41, 59);
      doc.text("INVOICE", 450, 55, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Invoice #: ${invoice.invoiceNo}`, 450, 72, { align: "right" });
      doc.text(`Date: ${formatDate(invoice.raisedOn)}`, 450, 86, { align: "right" });
      doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 450, 100, { align: "right" });
      doc.text(`Status: ${invoice.status.toUpperCase()}`, 450, 114, { align: "right" });

      // Line separator
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(1);
      doc.line(40, 130, 555, 130);

      // Billed To
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text("BILLED TO:", 40, 155);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(invoice.clientName || "Client", 40, 175);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Payment Mode: ${invoice.paymentMode || "Online"}`, 40, 190);
      doc.text(`Terms: ${invoice.paymentTerms || "Net 30"}`, 40, 204);

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(40, 230, 515, 28, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text("DESCRIPTION / SERVICE", 50, 248);
      doc.text("CURRENCY", 320, 248);
      doc.text("AMOUNT", 540, 248, { align: "right" });

      // Table Row
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Professional Services / Invoice ${invoice.invoiceNo}`, 50, 280);
      doc.text(invoice.currency, 320, 280);
      doc.text(formatCurrency(invoice.amount, invoice.currency), 540, 280, { align: "right" });

      // Line
      doc.setDrawColor(226, 232, 240);
      doc.line(40, 305, 555, 305);

      // Totals
      let y = 330;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("Subtotal:", 400, y);
      doc.text(formatCurrency(invoice.amount, invoice.currency), 540, y, { align: "right" });

      if (invoice.taxAmount > 0) {
        y += 20;
        doc.text(`Tax Withholding (${invoice.taxRate}%):`, 400, y);
        doc.text(`-${formatCurrency(invoice.taxAmount, invoice.currency)}`, 540, y, { align: "right" });

        y += 20;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(4, 120, 87);
        doc.text("Net Received:", 400, y);
        doc.text(formatCurrency(invoice.netReceived, invoice.currency), 540, y, { align: "right" });
      }

      y += 25;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("Total Invoiced:", 400, y);
      doc.text(formatCurrency(invoice.amount, invoice.currency), 540, y, { align: "right" });

      // Remarks / Bank Details footer
      doc.setDrawColor(203, 213, 225);
      doc.line(40, 430, 555, 430);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("PAYMENT INSTRUCTIONS & REMARKS", 40, 450);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const splitNotes = doc.splitTextToSize(
        `${invoice.remarks ? `Notes: ${invoice.remarks}\n\n` : ""}${settings.bankDetails}`,
        500
      );
      doc.text(splitNotes, 40, 468);

      doc.save(`Invoice_${invoice.invoiceNo}_${invoice.clientName}.pdf`);
      onShowToast(`Generated & downloaded PDF for ${invoice.invoiceNo}!`);
    } catch (e) {
      console.error(e);
      onShowToast("Failed to generate PDF", "error");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 className="modal-title">Invoice {invoice.invoiceNo}</h2>
            <div style={{ display: "flex", background: "var(--bg-surface-elevated)", padding: "2px", borderRadius: "var(--radius-sm)" }}>
              <button
                className={`btn btn-sm ${activeTab === "preview" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveTab("preview")}
              >
                Invoice Document
              </button>
              <button
                className={`btn btn-sm ${activeTab === "email" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveTab("email")}
              >
                <Mail size={13} />
                <span>Payment Reminder</span>
              </button>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "preview" ? (
            /* Invoice Paper Preview */
            <div className="invoice-paper">
              <div className="inv-header">
                <div>
                  <div className="inv-company-name">{settings.companyName || "SnS Global Solutions"}</div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{settings.companyAddress}</div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{settings.companyEmail}</div>
                </div>
                <div className="inv-badge">
                  <div className="inv-doc-title">INVOICE</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }} className="mono-num">
                    #{invoice.invoiceNo}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    Status: <strong style={{ color: invoice.status === "Received" ? "#047857" : "#d97706" }}>{invoice.status.toUpperCase()}</strong>
                  </div>
                </div>
              </div>

              <div className="inv-meta-grid">
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Billed To
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                    {invoice.clientName}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    Payment Mode: {invoice.paymentMode || "Online"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    <strong>Invoice Date:</strong> {formatDate(invoice.raisedOn)}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    <strong>Payment Due:</strong> {formatDate(invoice.dueDate)}
                  </div>
                  {invoice.receivedOn && (
                    <div style={{ fontSize: "0.85rem", color: "#047857" }}>
                      <strong>Settled On:</strong> {formatDate(invoice.receivedOn)}
                    </div>
                  )}
                </div>
              </div>

              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Terms</th>
                    <th>Currency</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Professional Services / Deliverables - Invoice {invoice.invoiceNo}</td>
                    <td>{invoice.paymentTerms || "Net 30"}</td>
                    <td>{invoice.currency}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }} className="mono-num">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="inv-totals">
                <div className="inv-totals-row">
                  <span>Gross Invoiced:</span>
                  <span className="mono-num">{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
                {invoice.taxAmount > 0 && (
                  <>
                    <div className="inv-totals-row" style={{ color: "#b91c1c" }}>
                      <span>Tax Withheld ({invoice.taxRate}%):</span>
                      <span className="mono-num">-{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                    </div>
                    <div className="inv-totals-row" style={{ color: "#047857", fontWeight: 700 }}>
                      <span>Net Received:</span>
                      <span className="mono-num">{formatCurrency(invoice.netReceived, invoice.currency)}</span>
                    </div>
                  </>
                )}
                <div className="inv-totals-row inv-totals-grand">
                  <span>Total Amount:</span>
                  <span className="mono-num">{formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
              </div>

              {invoice.remarks && (
                <div style={{ marginTop: "2rem", padding: "0.75rem 1rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <strong style={{ fontSize: "0.8rem", color: "#475569" }}>Remarks: </strong>
                  <span style={{ fontSize: "0.85rem", color: "#1e293b" }}>{invoice.remarks}</span>
                </div>
              )}
            </div>
          ) : (
            /* Email Reminder Copy */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Subject Line</label>
                <input
                  type="text"
                  className="form-input"
                  value={reminderEmailSubject}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Body Template</label>
                <textarea
                  className="form-textarea mono-num"
                  style={{ minHeight: "280px", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}
                  value={reminderEmailBody}
                  readOnly
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {activeTab === "preview" ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={15} />
                <span>Print</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDownloadPDF}>
                <Download size={15} />
                <span>Download PDF</span>
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleCopyEmail}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? "Copied!" : "Copy Email Template"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
