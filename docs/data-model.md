# Data Model — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

The workbook is the database. This document is its schema.

Implementation: [`src/lib/workbook.js`](../src/lib/workbook.js).

---

## 1. The file

| | |
|---|---|
| Default path | `Invoice Tracker.xlsx` beside the application |
| Override | `LEDGER_FILE` environment variable (browser mode) or the file picker (desktop) |
| Format | `.xlsx` (Office Open XML), written by SheetJS |
| Snapshots | `backups/Invoice Tracker <ISO timestamp>.xlsx`, last 30, beside the workbook |
| In-flight write | `Invoice Tracker.saving.xlsx`, renamed over the target on success |

Three sheets are managed. **Any other sheet in the workbook is preserved untouched** —
your own pivot tables and scratch sheets are safe.

| Sheet | Holds | Selected by |
|---|---|---|
| Invoices | One row per invoice | The sheet named `Invoices`, else the **first sheet** |
| Clients | One row per client | Name |
| Settings | Key/value configuration | Name |

The fallback to "first sheet" is what lets an existing hand-kept workbook (whose sheet is
called `Sheet1`) work without being renamed first.

---

## 2. Invoices sheet

Sixteen columns, written in this order. The first eleven are the original hand-kept
columns, preserved exactly; the five marked **new** were added in 2.0.0 so that facts
which used to hide inside prose have somewhere to live.

| # | Column | Type | Notes |
|---|---|---|---|
| 1 | `Invoice #` | Text | **Primary key.** Compared case-insensitively |
| 2 | `Client Name` | Text | References `Clients.Client Name` |
| 3 | `Actual Invoiced Amt` | Number | Gross amount in the invoice currency, 2 dp |
| 4 | `Mode of Payment` | Text | Online, Wire, NEFT, Bank Transfer, ACH, Cheque, Card, PayPal |
| 5 | `UOM` | Text | ISO 4217 code — the invoice currency |
| 6 | `Raised on` | Date | Whole-day serial, `yyyy-mm-dd` format |
| 7 | `Invoiced Month` | Text | Full month name; derived from `Raised on` if blank |
| 8 | `Collection Status` | Text | `Received` or `Outstanding` only — see §5 |
| 9 | `Received on` | Date | Blank when outstanding |
| 10 | `Due Date` | Date | **new** — was previously implied |
| 11 | `Term Days` | Number | **new** — payment terms, default 30 |
| 12 | `Due by (days)` | Number/Text | Days past due at time of save, `-` when settled. Informational only; the app recomputes it |
| 13 | `Tax %` | Number | **new** — withholding rate |
| 14 | `Tax Amount` | Number | **new** — withholding value, 2 dp |
| 15 | `Amount Received` | Number | **new** — cash actually received; blank when outstanding |
| 16 | `Remarks` | Text | Free text |

### 2.1 Legacy header aliases

Accepted on read, normalised on write. Whitespace and embedded newlines are collapsed
before matching, and matching is case-insensitive — so `Invoice \n#` and `Invoice #` are
the same column.

| Canonical | Also accepted |
|---|---|
| `Invoice #` | `Invoice No`, `Invoice` |
| `Client Name` | `Client` |
| `Actual Invoiced Amt` | `Amount`, `Invoiced Amt` |
| `Mode of Payment` | `Payment Mode` |
| `UOM` | `Currency` |
| `Raised on` | `Raised Date`, `Date` |
| `Received on` | `Received Date` |
| `Collection Status` | `Status` |
| `Tax %` | `Tax Rate` |
| `Amount Received` | `Net Received` |
| `Remarks` | `Notes` |

A row with no invoice number is skipped entirely, so trailing blank rows are harmless.

### 2.2 In-memory shape

```js
{
  invoiceNo:      "SnS02532",     // string, primary key
  clientName:     "V",            // string
  amount:         3381.95,        // number, gross, invoice currency
  currency:       "USD",          // 3-letter code, uppercased
  paymentMode:    "Online",       // string
  raisedOn:       "2026-01-12",   // ISO date
  invoicedMonth:  "January",      // string
  status:         "Received",     // "Received" | "Outstanding"
  receivedOn:     "2026-02-20",   // ISO date or ""
  dueDate:        "2026-02-11",   // ISO date
  termDays:       30,             // number
  taxRate:        15,             // number, percent
  taxAmount:      507.29,         // number
  amountReceived: 2874.66,        // number, 0 when outstanding
  remarks:        "Received payment after 15% tax deduction"
}
```

### 2.3 Fields added by `decorate()` at read time

Never stored. Recomputed on every render, in the current display currency.

| Field | Meaning |
|---|---|
| `status` | Upgraded to `Overdue` when outstanding and past due |
| `overdueDays` | Days past the due date; `0` when settled or not yet due |
| `daysToDue` | Days until due; negative once overdue |
| `daysToCollect` | Received date − raised date; `null` when unsettled |
| `receivedAmount` | Cash received; `0` when outstanding |
| `shortfall` | `amount − receivedAmount` for settled invoices |
| `base` | `amount` converted into the display currency |
| `receivedBase` | `receivedAmount` converted into the display currency |
| `taxBase` | `taxAmount` converted into the display currency |
| `month` | `invoicedMonth`, or derived from `raisedOn` |

---

## 3. Clients sheet

| Column | Type | Notes |
|---|---|---|
| `Client Name` | Text | **Key.** Must match the name used on invoices |
| `Display Name` | Text | Full legal or trading name shown in the interface |
| `Email` | Text | Billing contact, used in reminder emails |
| `Currency` | Text | Default currency for new invoices |
| `Term Days` | Number | Default payment terms |
| `Tax %` | Number | Standing withholding applied to new invoices |
| `Notes` | Text | Free text |

Two behaviours worth knowing:

- **Auto-discovery.** A client that appears on an invoice but has no row here is
  surfaced in the interface anyway, and written into the sheet on the next save.
- **Rename cascades.** Changing `Client Name` through the app rewrites every invoice
  referencing the old name in the same atomic write. Renaming it by hand in Excel does
  not — the invoices would be orphaned and the old name would reappear as an
  auto-discovered client.

---

## 4. Settings sheet

Two columns, `Key` and `Value`. One row per setting.

| Key | Type | Default | Purpose |
|---|---|---|---|
| `workspaceName` | Text | `Sengupta & Sons` | Shown in the interface, on PDFs and in exports |
| `workspaceEmail` | Text | `accounts@example.com` | Sign-off on reminder emails |
| `workspaceAddress` | Text | — | Address block on the invoice PDF (newline separated) |
| `taxId` | Text | — | Printed under the address on PDFs |
| `baseCurrency` | Text | `INR` | The unit all rates are quoted in |
| `invoicePrefix` | Text | `SnS` | Series prefix for generated invoice numbers |
| `defaultTermDays` | Number | `30` | Default payment terms on new invoices |
| `defaultPaymentMode` | Text | `Online` | Default method on new invoices |
| `bankDetails` | Text | — | Payment instructions block on PDFs and reminders |
| `rate.XXX` | Number | see below | Value of one XXX in the base currency |

Shipped rates: `rate.INR 1`, `rate.USD 87.4`, `rate.GBP 111.2`, `rate.CHF 108.5`,
`rate.EUR 94.8`.

**Adding a currency requires no code change** — add a `rate.AED` row (or use the
Settings screen) and it appears everywhere.

The base currency's own rate is forced to `1` on both read and write, so it can never be
made inconsistent by hand.

---

## 5. Status vocabulary

Only two values are ever written:

| Stored | Meaning |
|---|---|
| `Received` | A payment has been recorded |
| `Outstanding` | No payment recorded |

`Overdue` is **derived** — an outstanding invoice whose due date has passed — and is
recomputed every time the ledger is read. It is never written to the sheet and cannot be
set by hand. This is why a workbook left alone for six months still reports correctly
the day it is opened.

Legacy values (`Pending`, `Not received`, anything unrecognised) collapse to
`Outstanding` on read, so the file converges on one vocabulary after the first save.

Transitions:

```
Outstanding ──record payment / set status Received──► Received
Received ──────set status Outstanding (edit drawer)──► Outstanding
             (clears Received on and Amount Received)
Outstanding ─── due date passes (no write) ─────────► Overdue (display only)
```

---

## 6. Dates

**In memory:** ISO `YYYY-MM-DD` strings. **On disk:** whole-day Excel serial numbers with
a `yyyy-mm-dd` number format, so Excel treats them as real dates.

The conversion is done by hand rather than by SheetJS, for a specific reason: SheetJS
writes `Date` objects ten seconds past midnight and reads them back a few seconds short
of it, which shifts the calendar day for anyone east of Greenwich.

| Direction | Method |
|---|---|
| ISO → serial | `Date.UTC(y, m-1, d) / 86400000 + 25569`, applied to the three date columns after sheet construction |
| Serial → ISO | Epoch `1899-12-30` plus `n` days |
| `Date` cell → ISO | Add one minute, then read **local** calendar parts |
| Text → ISO | Passed through if already ISO, else parsed |
| `-` or blank | Empty string |

**"Today" is the local calendar date, never UTC.** Deriving it from
`new Date().toISOString()` reports yesterday between midnight and 05:30 in IST, which
would date receipts a day early and misreport every overdue count.

All of this is pinned by assertions in `store.test.js`. If you touch date handling, run
`npm test`.

---

## 7. Invariants

These hold at all times. Breaking one is a defect, not a preference.

1. `Invoice #` is unique, case-insensitively.
2. `status` on disk ∈ {`Received`, `Outstanding`}.
3. `Received on` is non-empty **iff** status is `Received`.
4. `Amount Received` is `0`/blank **iff** status is `Outstanding`; a settled invoice
   never records a zero receipt (it falls back to `amount − taxAmount`).
5. `Due Date` = `Raised on` + `Term Days`, unless explicitly overridden.
6. `Tax Amount` = `Actual Invoiced Amt` × `Tax %` ÷ 100, rounded to 2 dp.
7. `rates[baseCurrency]` = 1.
8. Every distinct `Client Name` on the Invoices sheet has a row on the Clients sheet
   after the next save.
9. Monetary values are rounded to 2 dp on write.
10. Date columns hold whole-day serials — never a fractional time component.

---

## 8. Validation

Applied at the boundary in both shells, before anything can reach the workbook
(`validateInvoice`). A failure writes nothing and returns every reason at once.

| Field | Rule | Message |
|---|---|---|
| `invoiceNo` | Required, non-blank | Invoice number is required |
| `clientName` | Required, non-blank | Client name is required |
| `amount` | Finite and > 0 | Amount must be a positive number |
| `raisedOn` | `YYYY-MM-DD` (defaults to today if blank) | Raised date must be YYYY-MM-DD |
| `receivedOn` | `YYYY-MM-DD` when present | Received date must be YYYY-MM-DD |
| `currency` | Exactly three letters | Currency must be a 3-letter code |
| `taxRate` | 0–100 inclusive | Tax % must be between 0 and 100 |
| `invoiceNo` | Not already present (create only) | Invoice `X` already exists → HTTP 409 |

Normalisation applied after validation passes:

- Strings trimmed; currency uppercased.
- `termDays` defaults to 30; `dueDate` computed if absent.
- `invoicedMonth` derived from `raisedOn` if absent.
- Status `Received` with no date → date set to today.
- Status `Received` with a zero/missing received amount → set to `amount − taxAmount`.
- Status `Outstanding` → received date and received amount cleared.

---

## 9. Withholding recovery from remarks

The original workbook recorded tax deducted at source only as prose:

> `Received payment after 15% tax deduction`

On read, if `Tax %` is empty, the first percentage in the remarks text is taken as the
withholding rate, and the amount and net are computed from it. This is how the existing
five invoices produced correct withholding figures without anyone re-keying them.

Once the file has been saved by the app, `Tax %` and `Tax Amount` hold the numbers and
the remarks text is just a note. The recovery only ever fills a gap; a declared `Tax %`
always wins.

---

## 10. Worked example — the live ledger

The five invoices in the workbook as shipped, and what the app derives from them
(display currency INR, rates as configured):

| Invoice | Client | Amount | Raised | Due | Received | Tax % | Received amt | In INR |
|---|---|---|---|---|---|---|---|---|
| SnS02530 | A | $6,816.60 | 2026-01-06 | 2026-02-05 | 2026-02-09 | 0 | $6,816.60 | ₹5.96 L |
| SnS02531 | B | CHF 228.00 | 2026-01-12 | 2026-02-11 | 2026-02-11 | 0 | CHF 228.00 | ₹24,738 |
| SnS02532 | V | $3,381.95 | 2026-01-12 | 2026-02-11 | 2026-02-20 | 15 | $2,874.66 | ₹2.96 L |
| SnS02533 | D | £141.57 | 2026-01-12 | 2026-02-11 | 2026-02-09 | 0 | £141.57 | ₹15,743 |
| SnS02534 | E | £125.80 | 2026-01-12 | 2026-02-11 | 2026-02-09 | 0 | £125.80 | ₹13,989 |

Totals: invoiced **₹9.46 L**, collected **₹9.01 L**, collection rate **95.3 %**, tax
withheld **₹44,337**, average days to pay **32**. The gap between invoiced and collected
is entirely the withholding on SnS02532 — which is exactly the point of giving it a
column.
