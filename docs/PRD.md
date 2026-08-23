# Product Requirements — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

---

## 1. Problem

A small consulting business bills a handful of international clients each month and
tracks the whole receivables position in one spreadsheet, `Invoice Tracker.xlsx`. The
spreadsheet works — it is portable, auditable, and the owner already trusts it — but it
does no thinking. Specifically:

1. **Nothing is derived.** Whether an invoice is overdue, how long a client takes to
   pay, what the total outstanding is in rupees across five currencies — all of it is
   worked out by eye, or not at all.
2. **Facts hide inside prose.** A 15% withholding deduction lives in the Remarks column
   as the sentence *"Received payment after 15% tax deduction"*. It cannot be summed,
   filtered or reconciled, and the shortfall it explains looks identical to a client
   underpaying.
3. **Multi-currency has no common denominator.** Invoices in USD, GBP, CHF, EUR and INR
   sit in one column with a currency code beside them. There is no answer to "how much
   are we owed", only "how much are we owed in each of five currencies".
4. **Aging is invisible.** There is a "Due by (days)" column that is stale the moment it
   is typed, because a spreadsheet does not know what today is unless told.
5. **Every document is manual.** Sending an invoice PDF or chasing a late payer means
   writing it from scratch each time.

The obvious fix — move to accounting SaaS — costs a subscription, puts the business's
financial records on someone else's servers, and takes away the spreadsheet the owner
actually wants to keep.

## 2. Product goal

Give the spreadsheet an interface. Keep the file exactly where it is, in the format the
owner already understands, and put a fast, precise application on top of it that does
the deriving, the converting, the chasing and the document generation — entirely on the
owner's laptop.

Success means the owner never opens Excel to *work*, only to look — and when they do
look, the file is still theirs, still readable, still portable.

## 3. Users

**Primary — the operator/owner.** Runs the business, raises the invoices, chases the
payments, and answers to the accountant. Comfortable with spreadsheets, not interested
in learning accounting software. Works on one Windows laptop. Uses the app in short,
frequent bursts: raise an invoice, log a receipt, check who is late.

**Secondary — the accountant.** Never touches the app. Receives CSV exports and the
workbook itself at quarter end. Requires that figures reconcile and that deductions are
explicit.

There is no third user, and the product is not designed to acquire one. See §6.

## 4. Product principles

1. **The spreadsheet stays sovereign.** The file is the database, not a copy of it. Any
   feature that would make the workbook a second-class citizen is rejected.
2. **Derive everything derivable.** If a number can be computed from the facts, it is
   computed — never typed, never stored, never allowed to go stale.
3. **Make deductions explicit.** Money that did not arrive gets a reason and a column,
   not a sentence in Remarks.
4. **One page for the daily loop.** Scan, find, act — without navigating. Depth exists
   for the jobs that genuinely need room.
5. **Nothing leaves the laptop.** No cloud, no account, no telemetry, no network calls.
6. **Boring, precise, quiet.** A ledger should read like paper: tabular numerals, right
   aligned money, colour reserved for financial state.

## 5. Scope — what the product does

### 5.1 Ledger management

| Capability | Detail |
|---|---|
| Raise an invoice | Auto-numbered in the existing series, client defaults prefilled, terms → due date computed |
| Edit an invoice | Every field, **including collection status** |
| Duplicate an invoice | Copy as a fresh unpaid invoice with the next number — the fast path for recurring monthly bills |
| Delete an invoice | Two-step confirm |
| Record a payment | Withholding %, amount received, date, method, with live reconciliation |
| Revert a payment | Switching status back to Outstanding clears the receipt entirely |

### 5.2 Understanding the position

| Capability | Detail |
|---|---|
| Headline figures | Invoiced, collected, outstanding, overdue, collection rate |
| Trend | Invoiced vs collected by month, 6/12/24 months, by amount or invoice count |
| Aging | Five buckets from Current to 90+ days |
| Attention queue | The overdue invoices, worst first |
| Client behaviour | Average days to pay, on-time rate, fastest/slowest, a Prompt→Slow rating |
| Payment reconciliation | Every receipt with withholding separated from unexplained shortfall |

### 5.3 Multi-currency

Every figure can be expressed in any configured currency, converted through the
workbook's base currency at rates the owner controls. Switching the display currency
restates the whole application; it never hides an invoice. Each invoice always shows
its own currency as the primary figure.

### 5.4 Documents and exports

Invoice PDF, reminder-email text to the clipboard, CSV of any filtered ledger view, and
six standing reports (revenue, collections, outstanding, aging, client performance,
payment timeliness) scoped by period, client and currency.

### 5.5 Deployment

A real installed desktop application (Tauri, ~12 MB) as the primary form, with a
browser mode behind a localhost Node server as a fallback for machines without the
build toolchain.

## 6. Out of scope — deliberately

These are not "not yet". They are decisions:

| Not doing | Why |
|---|---|
| Cloud sync / hosted service | The premise of the product is that the data never leaves the laptop. |
| Multi-user, accounts, permissions | One operator. Auth would add risk and complexity protecting nothing. |
| Live exchange-rate feeds | A figure in a ledger must not change because a third party moved. Rates are entered by hand and dated by the owner. |
| Bank feeds / payment gateways | Requires cloud, credentials and reconciliation risk far beyond the value here. |
| Emailing invoices directly | Needs SMTP credentials and a network. The app prepares the text; the mail client sends it. |
| Double-entry bookkeeping, VAT/GST returns | This is a receivables ledger, not an accounting package. The accountant has one of those. |
| Mobile app | The work is a dense table on a laptop. The layout degrades gracefully; it is not a phone product. |
| Dark theme | A ledger reads like paper. One theme, correct contrast, no second set of bugs. |
| Excel import | Obsolete: the workbook *is* the database. There is nothing to import into. |

## 7. Success criteria

| # | Criterion | Measure |
|---|---|---|
| S1 | The workbook remains usable in Excel | Open it after any app session: dates are dates, numbers are numbers, original columns intact |
| S2 | No data loss, ever | Atomic writes + 30 rolling snapshots; a corrupted or lost ledger is a P0 defect |
| S3 | Daily loop needs no navigation | Raise, edit, duplicate, settle, delete all reachable from the home page |
| S4 | Deductions are auditable | Every shortfall is either declared withholding or flagged as unexplained |
| S5 | Multi-currency answers in one number | Total receivables in any chosen currency, on screen, always |
| S6 | Zero network activity | No outbound requests in the running app, including fonts |
| S7 | Cold start under 3 seconds | Desktop build from click to ledger on screen |

## 8. Release history

| Version | What changed |
|---|---|
| 1.0.0 | React SPA, `localStorage` state, Excel import/export, modal-based editing, dark/light theme, single page with top bar |
| 2.0.0 | Excel workbook promoted to database; Node server and Tauri desktop shells; nine-screen FinanceOS design; workspace page merging dashboard and ledger; per-row action menu; editable collection status; duplicate; self-hosted fonts; automated round-trip tests |

### Known gaps carried into 2.0.0

- Client records cannot be deleted from the interface (edit and rename only); remove the
  row from the `Clients` sheet in Excel.
- Reports have fixed definitions; there is no custom report builder.
- One workbook per app instance. Multiple businesses mean multiple installs.

## 9. Direction, if it is ever needed

Ordered by likelihood, not commitment:

1. **Recurring invoice schedules** — duplicate is the manual version of this today.
2. **Attachment links** — a path column pointing at the signed PO or contract.
3. **SQLite behind the same interface** — only if row counts reach the tens of
   thousands, keeping the workbook as a generated export.
4. **Second business app** — expenses or purchase orders, cloned from this repo's shape
   rather than bolted on as a module. See [operations.md](operations.md#cloning-into-a-second-app).
