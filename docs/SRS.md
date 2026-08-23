# Software Requirements Specification — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

Requirements are numbered and testable. `FR` = functional, `DR` = data, `IR` =
interface, `NFR` = non-functional, `CON` = constraint. Where a requirement is covered by
an automated check, the check is named; the rest are verified by the manual script in
[testing.md](testing.md).

---

## 1. Scope

FinanceOS is a single-user desktop application that manages invoices, receipts and
receivables for one business, storing all state in one Excel workbook on the local
filesystem. It ships in two forms — a Tauri desktop application and a browser
application served by a local Node process — which share all logic and behave
identically.

Out of scope items are listed in [PRD.md §6](PRD.md#6-out-of-scope--deliberately) and
are not restated here.

## 2. Definitions

| Term | Meaning |
|---|---|
| **Ledger / workbook** | The `.xlsx` file that holds all application state |
| **Base currency** | The currency all exchange rates are quoted against; stored in the workbook |
| **Display currency** | The currency the interface is currently expressing totals in; a view setting, not stored |
| **Outstanding** | An invoice with no receipt recorded |
| **Overdue** | An outstanding invoice whose due date has passed; always derived, never stored |
| **Withholding** | Tax deducted at source by the client (e.g. 15% TDS) — expected shortfall |
| **Unexplained shortfall** | Money missing beyond the declared withholding |
| **Shell** | One of the two IO layers (desktop / server) around the shared core |

## 3. Functional requirements

### 3.1 Ledger data access

| ID | Requirement | Verified by |
|---|---|---|
| FR-1 | The system shall read all invoices, clients and settings from a single Excel workbook on load. | `store.test.js` round-trip |
| FR-2 | The system shall treat the workbook as the sole system of record; no application state shall persist anywhere else except view preferences (display currency, analytics panel open/closed, chosen workbook path). | Code review |
| FR-3 | Every mutation shall re-read the workbook, apply the change, write it back, and re-read the result before updating the interface. | Code review; manual QA-14 |
| FR-4 | The system shall accept a workbook whose invoice sheet uses the original hand-kept column names, including embedded newlines (`Invoice \n#`, `Collection \nStatus`). | `store.test.js` legacy-sheet parse |
| FR-5 | The system shall use the sheet named `Invoices` if present, otherwise the first sheet in the workbook. | `store.test.js` legacy save |
| FR-6 | On write, the system shall preserve any sheets it does not manage. | Code review (`buildWorkbook` reads existing bytes) |
| FR-7 | The system shall create `Clients` and `Settings` sheets on first write if absent. | `store.test.js` round-trip |

### 3.2 Invoice lifecycle

| ID | Requirement | Verified by |
|---|---|---|
| FR-10 | The user shall be able to create an invoice specifying number, client, amount, currency, raised date, payment terms, payment method, withholding %, and remarks. | Manual QA-3 |
| FR-11 | The system shall propose the next invoice number by taking the highest number matching the configured prefix and incrementing it, zero-padded to at least five digits. | Manual QA-3 |
| FR-12 | Selecting an existing client shall prefill that client's default currency, payment terms and standing withholding on a new invoice. | Manual QA-4 |
| FR-13 | The due date shall be computed as raised date + term days and shall not be directly editable. | Manual QA-3 |
| FR-14 | Creating an invoice for an unknown client shall create that client record automatically. | Code review (`mutations.createInvoice`) |
| FR-15 | The user shall be able to edit every field of an existing invoice, including collection status. | Manual QA-6 |
| FR-16 | The user shall be able to duplicate an invoice: same client, amount, currency, method, terms and withholding; next number in the series; today's raised date; status Outstanding; no receipt; remarks prefixed `Copy of <number>`. | Manual QA-5 |
| FR-17 | The user shall be able to delete an invoice, with a two-step confirmation. | Manual QA-7 |
| FR-18 | Rejecting a duplicate invoice number, the system shall return a conflict and change nothing. | Manual QA-8 |

### 3.3 Payments and status

| ID | Requirement | Verified by |
|---|---|---|
| FR-20 | The user shall be able to record a payment specifying withholding %, amount received, date and method. | Manual QA-9 |
| FR-21 | The payment form shall display live reconciliation: invoice amount, withholding, amount received, and the difference. | Manual QA-9 |
| FR-22 | The system shall distinguish a shortfall equal to the declared withholding from an unexplained shortfall, and shall state the unexplained amount. | Manual QA-9 |
| FR-23 | Setting status to Received without a date shall default the date to today rather than silently reverting the status. | `store.test.js` marked-received |
| FR-24 | Setting status to Received with a zero or missing amount received shall default it to amount − withholding. | `store.test.js` marked-received |
| FR-25 | Setting status back to Outstanding shall clear the received date and received amount. | `store.test.js` reverted |
| FR-26 | Recording a withholding above zero shall append a note to remarks unless one for that rate already exists. | Code review (`PaymentDrawer`) |
| FR-27 | Only `Received` and `Outstanding` shall be persisted as status. | `store.test.js` legacy `Pending` → Outstanding |
| FR-28 | `Overdue` shall be derived at read time from the due date and shall never be stored or manually settable. | `store.test.js`; code review (`decorate`) |

### 3.4 Currency

| ID | Requirement | Verified by |
|---|---|---|
| FR-30 | Exchange rates shall be quoted as the value of one unit of a currency in the base currency, editable by the user, stored in the workbook. | `store.test.js` rate round-trip |
| FR-31 | The base currency's own rate shall always be 1. | Code review (`parseWorkbook`, `saveSettings`) |
| FR-32 | The user shall be able to change the display currency; all totals, charts, aging and client figures shall restate in it. | `store.test.js` conversion; manual QA-11 |
| FR-33 | Changing the display currency shall never filter, hide or reorder invoices. | `store.test.js` conversion |
| FR-34 | Conversion between two non-base currencies shall pivot through the base currency. | `store.test.js` cross rate |
| FR-35 | Each invoice shall display its own currency as the primary amount, with the converted equivalent shown secondarily when it differs from the display currency. | Manual QA-11 |
| FR-36 | Filtering the ledger by invoice currency shall be a separate control from the display currency. | Manual QA-12 |

### 3.5 Analysis

| ID | Requirement | Verified by |
|---|---|---|
| FR-40 | The system shall present total invoiced, total collected, outstanding, overdue and collection rate in the display currency. | Manual QA-1 |
| FR-41 | The system shall chart invoiced vs collected by calendar month over 6, 12 or 24 months, by amount or by invoice count. | Manual QA-13 |
| FR-42 | The system shall bucket outstanding receivables into Current, 1–30, 31–60, 61–90 and 90+ days past due, with amount, count and share. | Manual QA-1 |
| FR-43 | The system shall list overdue invoices worst-first with a one-click path to record payment. | Manual QA-1 |
| FR-44 | The system shall compute per-client totals, average days to pay, on-time rate, fastest and slowest settlement, preferred payment method, and a behaviour rating. | Manual QA-15 |
| FR-45 | The system shall present activity (invoices raised, payments received, invoices going overdue) reconstructed from the ledger, newest first. | Manual QA-1 |

### 3.6 Search, filter, sort

| ID | Requirement | Verified by |
|---|---|---|
| FR-50 | The ledger shall be filterable by status, invoice currency, invoiced month and client, in any combination. | Manual QA-12 |
| FR-51 | The ledger shall be searchable across invoice number, client name, remarks and amount. | Manual QA-12 |
| FR-52 | The ledger shall be sortable by invoice number, client, amount, raised date, due date and status, ascending or descending. | Manual QA-12 |
| FR-53 | The ledger shall show the count and total value of the rows currently displayed. | Manual QA-12 |
| FR-54 | A control to clear all filters shall be offered whenever any filter is set, regardless of whether it changed the row count. | Manual QA-12 |
| FR-55 | A command palette shall open on `Ctrl/⌘+K` and offer navigation to any screen, invoice or client, navigable by arrow keys. | Manual QA-16 |

### 3.7 Documents and export

| ID | Requirement | Verified by |
|---|---|---|
| FR-60 | The system shall generate a single-page A4 PDF invoice including workspace details, client, amounts, withholding, and payment instructions. | Manual QA-17 |
| FR-61 | The system shall place a ready-to-send reminder email (subject and body, stating current status) on the clipboard. | Manual QA-18 |
| FR-62 | The system shall export the current filtered ledger view to CSV, UTF-8 with BOM, including both original and converted amounts. | Manual QA-19 |
| FR-63 | The system shall offer six report exports — revenue, collections, outstanding receivables, aging, client performance, payment timeliness — scoped by period, client and display currency. | Manual QA-20 |

### 3.8 Configuration

| ID | Requirement | Verified by |
|---|---|---|
| FR-70 | The user shall be able to edit workspace name, billing email, tax ID, address block, bank/payment instructions, invoice prefix, base currency, default payment terms and all exchange rates. | Manual QA-21 |
| FR-71 | All configuration shall be stored in the workbook's `Settings` sheet. | `store.test.js` settings round-trip |
| FR-72 | The settings screen shall display the absolute path of the active workbook. | Manual QA-21 |
| FR-73 | In the desktop build, the user shall be able to choose a different workbook at any time. | Manual QA-22 |

### 3.9 Desktop specifics

| ID | Requirement | Verified by |
|---|---|---|
| FR-80 | On first launch with no workbook chosen, the desktop build shall present a picker rather than an empty ledger. | Manual QA-22 |
| FR-81 | The chosen workbook path shall persist across restarts. | Manual QA-22 |
| FR-82 | If the remembered workbook is missing, the system shall say so and offer to choose another; it shall not create a replacement silently. | Code review (`desktop.js readData`) |

## 4. Data requirements

| ID | Requirement |
|---|---|
| DR-1 | Dates shall be held as ISO `YYYY-MM-DD` in memory and written as whole-day Excel date serials formatted `yyyy-mm-dd`. |
| DR-2 | Date values shall not drift by a day in any timezone, in either direction. |
| DR-3 | "Today" shall be the user's local calendar date, never the UTC date. |
| DR-4 | Monetary values shall be rounded to two decimal places on write. |
| DR-5 | Invoice number shall be the primary key, compared case-insensitively. |
| DR-6 | Client name on an invoice shall reference the `Clients` sheet by name; renaming a client shall update every invoice referencing it. |
| DR-7 | Withholding declared only in remarks text (`"…after 15% tax deduction"`) shall be recovered into the `Tax %` column on read. |
| DR-8 | A client appearing on an invoice but absent from the `Clients` sheet shall be surfaced as a client record. |

Full schema in [data-model.md](data-model.md). DR-1 to DR-3 are covered by
`store.test.js` (whole-serial, no-drift and local-today assertions).

## 5. External interface requirements

### 5.1 REST API (browser mode only, `127.0.0.1:4321`)

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/api/data` | — | `{invoices, clients, settings, file}` | 500 |
| POST | `/api/invoices` | invoice | full dataset | 400, 409, 423, 500 |
| PUT | `/api/invoices/:no` | invoice | full dataset | 400, 404, 423, 500 |
| DELETE | `/api/invoices/:no` | — | full dataset | 404, 423, 500 |
| POST | `/api/clients` | client (+`originalName` to rename) | full dataset | 400, 423, 500 |
| POST | `/api/settings` | partial settings | full dataset | 423, 500 |

| ID | Requirement |
|---|---|
| IR-1 | The server shall bind to `127.0.0.1` only. |
| IR-2 | Validation failures shall return `400` with an `errors` array of human-readable strings. |
| IR-3 | A workbook locked by Excel shall return `423` with a message naming the file and the remedy. |
| IR-4 | Request bodies shall be rejected above 2 MB. |
| IR-5 | Unknown API paths shall return `404`; unknown non-API paths shall serve the SPA entry point. |
| IR-6 | The desktop build shall expose the same operations through the same method names, without HTTP. |

### 5.2 Filesystem

| ID | Requirement |
|---|---|
| IR-10 | The ledger path shall default to `Invoice Tracker.xlsx` beside the application, overridable by the `LEDGER_FILE` environment variable (server) or the file picker (desktop). |
| IR-11 | Snapshots shall be written to a `backups/` directory beside the workbook. |
| IR-12 | Desktop filesystem access shall be scoped to the user's home, documents, desktop and downloads directories. |

## 6. Non-functional requirements

### 6.1 Data integrity

| ID | Requirement |
|---|---|
| NFR-1 | Writes shall be atomic: serialise to a temporary file, then rename over the target. |
| NFR-2 | A snapshot of the workbook shall be taken before every write, retaining the most recent 30. |
| NFR-3 | Exactly one code path shall write the workbook. |
| NFR-4 | A failed write shall leave the previous workbook byte-intact. |
| NFR-5 | The desktop and server shells shall produce identical output for identical input. |

### 6.2 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-10 | Cold start (desktop, click to ledger rendered) | < 3 s |
| NFR-11 | Read and render the full dataset | < 200 ms at 1,000 invoices |
| NFR-12 | Save round-trip (write, re-read, re-render) | < 500 ms at 1,000 invoices |
| NFR-13 | Filter, sort and search response | < 50 ms, no perceptible lag |
| NFR-14 | Installed desktop footprint | < 20 MB |

### 6.3 Security and privacy

| ID | Requirement |
|---|---|
| NFR-20 | The application shall make no outbound network requests of any kind, including fonts, analytics and update checks. |
| NFR-21 | The desktop content security policy shall permit `self` origins only. |
| NFR-22 | No credentials, tokens or personal data shall be transmitted anywhere. |
| NFR-23 | The browser-mode server shall be unreachable from other machines. |
| NFR-24 | Input shall be validated at the boundary before reaching the workbook, in both shells. |

### 6.4 Usability and accessibility

| ID | Requirement |
|---|---|
| NFR-30 | Body text shall meet WCAG AA contrast (≥ 4.5:1); supporting text shall meet large-text contrast (≥ 3:1). |
| NFR-31 | All interactive elements shall show a visible focus ring; focus shall never be suppressed. |
| NFR-32 | `Escape` shall close any drawer, menu or palette. |
| NFR-33 | Transitions shall collapse under `prefers-reduced-motion`. |
| NFR-34 | Status changes and errors shall be announced through a live region. |
| NFR-35 | Numeric columns shall use tabular figures and right alignment. |
| NFR-36 | Destructive actions shall require a second confirming click. |
| NFR-37 | No layout shall produce horizontal page scroll at 1024 px width or above; dense tables shall shed columns rather than overflow. |

### 6.5 Maintainability

| ID | Requirement |
|---|---|
| NFR-40 | Workbook mapping, validation and mutation logic shall exist in exactly one module shared by both shells. |
| NFR-41 | The Rust layer shall contain no business logic. |
| NFR-42 | Automated checks shall cover the workbook round trip, legacy parsing, date encoding, status transitions and currency conversion, and shall run with `npm test` without a framework. |
| NFR-43 | Adding a currency shall require no code change — only a rate in the `Settings` sheet. |

## 7. Constraints

| ID | Constraint |
|---|---|
| CON-1 | Windows is the primary platform; the stack is cross-platform but only Windows is tested. |
| CON-2 | Excel holds an exclusive lock on an open workbook; the application cannot write while the file is open and must fail clearly instead. |
| CON-3 | Node.js LTS is required for browser mode; Rust and MSVC build tools are required to *build* (not to run) the desktop app. |
| CON-4 | Whole-workbook rewrite per save makes the design unsuitable beyond roughly 50,000 rows. |
| CON-5 | Single writer by construction: two instances pointed at one workbook will overwrite each other. |
| CON-6 | Exchange rates are manual; the product deliberately has no rate feed. |

## 8. Assumptions

1. One person uses the application at a time, on one machine.
2. The workbook lives on a local disk or a synced folder that is not being written by
   another device concurrently.
3. Invoice numbers are unique and follow a prefixed numeric series.
4. Invoices are single-line; there is no line-item breakdown.
5. Payment terms are whole days from the raised date.

## 9. Traceability

| Requirement group | Primary implementation |
|---|---|
| FR-1 to FR-7, DR-* | `src/lib/workbook.js`, `server/store.js`, `src/lib/desktop.js` |
| FR-10 to FR-28 | `src/lib/workbook.js` (`validateInvoice`, `mutations`), `src/components/InvoiceDrawer.jsx`, `src/components/PaymentDrawer.jsx` |
| FR-30 to FR-36 | `src/lib/derive.js` (`convert`, `decorate`), `src/App.jsx`, `src/components/Topbar.jsx` |
| FR-40 to FR-45 | `src/lib/derive.js`, `src/screens/Workspace.jsx`, `src/screens/Clients.jsx` |
| FR-50 to FR-55 | `src/screens/Workspace.jsx`, `src/components/CommandPalette.jsx` |
| FR-60 to FR-63 | `src/lib/exporters.js`, `src/screens/Reports.jsx` |
| FR-70 to FR-73 | `src/screens/Settings.jsx` |
| FR-80 to FR-82 | `src/lib/desktop.js`, `src/components/Welcome.jsx` |
| IR-1 to IR-5 | `server/server.js` |
| NFR-1 to NFR-5 | `server/store.js`, `src/lib/desktop.js` |
| NFR-20 to NFR-23 | `src-tauri/tauri.conf.json`, `public/fonts/`, `server/server.js` |
| NFR-30 to NFR-37 | `src/styles.css` |
