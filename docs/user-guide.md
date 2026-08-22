# User Guide & Operational Workflows

This guide provides end-to-end instructions for daily operations, invoice issuance, payment reconciliation, Excel synchronization, and client management in **Invoice Tracker**.

---

## 1. Getting Started

When you launch Invoice Tracker, the ledger is preloaded with your initial transactions from `Invoice Tracker.xlsx` (`SnS02530` through `SnS02534`).

### Dashboard Overview
- **Executive Bento Grid**: At the top of the screen, you will find real-time summaries of your Total Realized Cash, Active Pending Balances, Overdue Aging, and Collection Ratios.
- **Base Currency**: Click the **Base** dropdown in the top navigation bar at any time to convert all aggregate totals into your preferred currency (`USD`, `EUR`, `GBP`, `CHF`, `INR`, etc.).

---

## 2. Managing Invoices

### 2.1 Creating a New Invoice
1. Click the **`+ New Invoice`** button in the top navigation header.
2. The form automatically suggests the next sequential invoice number (e.g., `SnS02535`).
3. Fill in the required fields:
   - **Invoice #**: Auto-filled or customized.
   - **Client Name**: Select from the dropdown autocomplete or type a new client name.
   - **Amount & Currency**: Enter the invoiced sum and choose the transaction currency (`USD`, `CHF`, `GBP`, etc.).
   - **Raised Date**: Today's date by default.
   - **Payment Terms**: Select **Net 0**, **Net 15**, **Net 30**, **Net 45**, **Net 60**, or **Custom**. The **Due Date** will automatically calculate.
   - **Remarks**: Optional client notes, contract references, or statutory notes.
4. Click **Create Invoice**. The record appears immediately at the top of your ledger.

---

### 2.2 Reconciling a Settlement ("Mark as Paid")
When a client remits payment:
1. Locate the invoice in the ledger and click the **`Paid`** button in the Actions column.
2. In the settlement dialog:
   - **Date Payment Received**: Select the date funds cleared your account.
   - **Tax / TDS Withholding (%)**: If the client deducted withholding tax (e.g. 15% TDS), select the tax percentage.
   - The dialog automatically calculates:
     - **Gross Invoiced**
     - **Tax Withheld**
     - **Net Amount Credited**
3. Review the auto-generated remarks (e.g. *"Received payment after 15% tax deduction"*).
4. Click **Confirm & Mark as Paid**. A celebratory confetti burst confirms the settlement.

---

### 2.3 Duplicating or Editing Invoices
- **Edit**: Click the **pencil icon** on any row to modify amounts, dates, or remarks.
- **Duplicate**: Click the **copy icon** on any row to instantly generate a new invoice pre-filled with the same client, currency, and amount, with the invoice sequence incremented automatically.

---

## 3. Filtering, Searching & Batch Actions

### 3.1 Segmented Status Tabs
Use the tabs above the ledger table for rapid 1-click filtering:
- **All**: Displays all historical records with total count badge.
- **Received**: Filters for settled invoices.
- **Pending**: Filters for active invoices within their payment terms.
- **Overdue**: Displays invoices past their due date requiring follow-up.

### 3.2 Live Search & Dropdown Filters
- **Search Bar**: Type any client name, invoice number, amount, or keyword from remarks.
- **Currency Filter**: Filter by specific currencies (e.g. view only `CHF` or `GBP` records).
- **Month Filter**: Filter by billing calendar month (e.g. `January`).

### 3.3 Multi-Select Bulk Actions
1. Check the box next to one or more rows (or click the header checkbox to select all filtered items).
2. The **Bulk Action Bar** appears above the table.
3. Click **Delete Selected** to safely remove multiple records in one action.

---

## 4. Excel Synchronization (.xlsx)

### 4.1 Exporting to Excel
1. Click the **`Export`** button in the top navigation bar.
2. An `.xlsx` spreadsheet (`Invoice_Tracker_YYYY-MM-DD.xlsx`) is instantly downloaded.
3. The exported file matches the exact column headers and structure of your original Excel sheet:
   `Invoice #`, `Client Name`, `Actual Invoiced Amt`, `Mode of Payment`, `UOM`, `Raised on`, `Invoiced Month`, `Collection Status`, `Received on`, `Due by (days)`, `Remarks`.

### 4.2 Importing an Existing Excel or CSV File
1. Click the **`Import`** button in the top navigation bar.
2. Select your `.xlsx`, `.xls`, or `.csv` file.
3. The parser automatically cleans header names, extracts date formats, reconciles tax deduction notes, and merges the records into your ledger.

---

## 5. Generating Invoices (PDF) & Payment Reminders

1. Click the **eye icon** (Preview) on any row in the ledger table.
2. **Invoice Document Tab**:
   - Preview a professional, branded A4 invoice document.
   - Click **`Download PDF`** to generate a clean client-ready vector PDF.
   - Click **`Print`** to trigger native browser printing.
3. **Payment Reminder Tab**:
   - Switch to the **Payment Reminder** tab.
   - The application automatically formats an email reminder containing the client name, invoice number, due date/overdue duration, and your wire payment details.
   - Click **`Copy Email Template`** to copy the subject line and body to your clipboard.

---

## 6. Client Directory & Business Settings

### 6.1 Client Directory
- Click **`Clients`** in the navigation bar to review all registered clients.
- View total billed revenue, total cash collected, open balances, and invoice counts per client.
- Add new client profiles with default currencies and payment terms.

### 6.2 Business Preferences
- Click the **gear icon** (Settings) in the navigation bar to update:
  - Business / Trading entity name.
  - Accounts contact email and address.
  - Custom invoice prefix (default: `SnS`).
  - Wire / ACH banking instructions.
