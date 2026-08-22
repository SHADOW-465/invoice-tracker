# Data Schema & Storage Specifications

This document defines the entity schemas, type definitions, storage serialization models, and bidirectional Excel mapping structures used throughout **Invoice Tracker**.

---

## 1. Core Entity Models

### 1.1 `Invoice` Entity

The `Invoice` entity represents an individual receivable billing record.

```typescript
interface Invoice {
  /** Unique primary identifier (e.g. "inv-1", "inv-1724345000-abcd") */
  id: string;

  /** Human-readable invoice reference number (e.g. "SnS02530") */
  invoiceNo: string;

  /** Name of the client or entity billed */
  clientName: string;

  /** Gross invoiced monetary amount */
  amount: number;

  /** 3-letter currency code (e.g. "USD", "CHF", "GBP", "EUR") */
  currency: string;

  /** Mode of remittance (e.g. "Online", "Wire Transfer", "Credit Card") */
  paymentMode: string;

  /** Date invoice was issued in ISO format: "YYYY-MM-DD" */
  raisedOn: string;

  /** Calendar month name (e.g. "January", "February") */
  invoicedMonth: string;

  /** Current collection status */
  status: "Received" | "Pending" | "Overdue" | "Partially Paid" | "Draft" | "Cancelled";

  /** Date payment was received in ISO format: "YYYY-MM-DD" (empty if unpaid) */
  receivedOn: string;

  /** Agreed payment terms preset (e.g. "Net 30", "Net 15", "Due Immediately") */
  paymentTerms: string;

  /** Computed payment due date in ISO format: "YYYY-MM-DD" */
  dueDate: string;

  /** Applied withholding tax or TDS rate in percentage (e.g. 15 for 15%) */
  taxRate: number;

  /** Monetary tax deduction amount calculated from taxRate */
  taxAmount: number;

  /** Actual net cash amount credited after tax deduction */
  netReceived: number;

  /** Freeform notes, deduction explanations, or bank transaction references */
  remarks: string;
}
```

---

### 1.2 `Client` Entity

The `Client` entity stores recurring client profiles, payment habits, and default billing terms.

```typescript
interface Client {
  /** Unique client identifier (e.g. "c-1", "c-1724345000") */
  id: string;

  /** Client or organization name (e.g. "Acme Corp") */
  name: string;

  /** Primary billing or accounts contact email */
  email: string;

  /** Default currency code for new invoices issued to this client */
  defaultCurrency: string;

  /** Default payment terms for this client (e.g. "Net 30") */
  defaultTerms: string;

  /** Client-specific operational notes (e.g. "15% withholding tax applicable") */
  notes: string;
}
```

---

### 1.3 `Settings` Entity

The `Settings` entity configures global entity details, invoice prefixes, and banking instructions.

```typescript
interface BusinessSettings {
  /** Legal or trading entity name displayed on invoices and headers */
  companyName: string;

  /** Billing contact email */
  companyEmail: string;

  /** Physical or postal address */
  companyAddress: string;

  /** Tax identification number (e.g. "US-987654321") */
  taxId: string;

  /** Prefix for invoice numbering auto-generation (e.g. "SnS") */
  invoicePrefix: string;

  /** Default payment terms for new invoices (e.g. "Net 30") */
  defaultPaymentTerms: string;

  /** Global default currency for new records */
  defaultCurrency: string;

  /** Full wire / bank remittance details printed on PDF invoices */
  bankDetails: string;
}
```

---

### 1.4 `Currency` Definition

```typescript
interface Currency {
  code: string;       // "USD", "EUR", "GBP", "CHF", "INR", "CAD", "AUD", "SGD"
  symbol: string;     // "$", "€", "£", "CHF ", "₹", "CA$", "AU$", "SG$"
  name: string;       // "US Dollar", "Euro", "British Pound", "Swiss Franc", ...
  rateToBase: number; // Conversion multiplier relative to 1 USD
}
```

---

## 2. Seed Data from `Invoice Tracker.xlsx`

The application includes the 5 initial transactions from the original `Invoice Tracker.xlsx` spreadsheet:

| Invoice # | Client | Amount | Currency | Raised On | Status | Settled On | Remarks / Tax Deduction |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`SnS02530`** | `A` | 6,816.60 | `USD` | 2026-01-06 | `Received` | 2026-02-09 | Standard settlement |
| **`SnS02531`** | `B` | 228.00 | `CHF` | 2026-01-12 | `Received` | 2026-02-11 | Standard settlement |
| **`SnS02532`** | `V` | 3,381.95 | `USD` | 2026-01-12 | `Received` | 2026-02-20 | Received payment after 15% tax deduction ($507.29 tax withheld, $2,874.66 net received) |
| **`SnS02533`** | `D` | 141.57 | `GBP` | 2026-01-12 | `Received` | 2026-02-09 | Standard settlement |
| **`SnS02534`** | `E` | 125.80 | `GBP` | 2026-01-12 | `Received` | 2026-02-09 | Standard settlement |

---

## 3. LocalStorage Persistence Schema

State is stored in the browser's `localStorage` under versioned keys to prevent collision:

| Storage Key | Type | Description |
| :--- | :--- | :--- |
| `apex_finance_invoices_v1` | `JSON.stringify(Invoice[])` | Array of all active and settled invoice records. |
| `apex_finance_clients_v1` | `JSON.stringify(Client[])` | Array of registered client profiles. |
| `apex_finance_settings_v1` | `JSON.stringify(BusinessSettings)` | Global company details and banking preferences. |
| `apex_finance_base_currency_v1` | `string` | User-selected base currency code (default: `"USD"`). |
| `apex_finance_theme_v1` | `string` | UI theme preference (`"dark"` or `"light"`). |

---

## 4. Bidirectional Excel (`.xlsx`) Mapping Specification

### 4.1 Export Column Mapping (`exportToExcel`)

When exporting to `.xlsx`, the resulting sheet matches the original columns and layout:

| Excel Column Header | Invoice Entity Field | Format / Type | Column Width (`wch`) |
| :--- | :--- | :--- | :--- |
| **Invoice #** | `inv.invoiceNo` | String | 14 |
| **Client Name** | `inv.clientName` | String | 18 |
| **Actual Invoiced Amt** | `inv.amount` | Number (2 decimals) | 22 |
| **Mode of Payment** | `inv.paymentMode` | String | 18 |
| **UOM** | `inv.currency` | String | 8 |
| **Raised on** | `inv.raisedOn` | String (YYYY-MM-DD) | 14 |
| **Invoiced Month** | `inv.invoicedMonth` | String | 16 |
| **Collection Status** | `inv.status` | String | 18 |
| **Received on** | `inv.receivedOn` | String (YYYY-MM-DD) | 14 |
| **Due by (days)** | Aging days or `"-"` if received | Number or String | 16 |
| **Remarks** | `inv.remarks` | String | 45 |

---

### 4.2 Import Column Resolution & Tax Parsing (`parseExcelFile`)

When importing an Excel or CSV file:
1. **Header Normalization**: Strips line breaks (`\n`), trims whitespace, and evaluates synonyms.
2. **Date Parsing**: Safely handles Excel serial dates, Javascript `Date` objects, and text strings.
3. **Tax Deduction Heuristic**: Checks `Remarks` for patterns like `"15% tax"` or `"15% tax deduction"`, automatically computing `taxRate = 15`, `taxAmount`, and `netReceived`.
4. **Deduplication**: By default, imports merge with existing records based on matching `invoiceNo`.
