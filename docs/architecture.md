# Architecture — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

---

## 1. The shape in one picture

```
┌─────────────────────────────────────────────────────────────────────┐
│  React interface  (src/screens, src/components)                     │
│  One `ctx` object carries data + actions to every screen            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  ctx.saveInvoice / deleteInvoice / …
┌───────────────────────────────▼─────────────────────────────────────┐
│  src/lib/api.js — picks a shell at runtime                          │
│  window.__TAURI_INTERNALS__ present?  desktop : http                │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │                                  │
┌──────────────▼─────────────────┐  ┌─────────────▼───────────────────┐
│ DESKTOP SHELL                  │  │ BROWSER SHELL                   │
│ src/lib/desktop.js             │  │ src/lib/api.js → HTTP           │
│ Tauri fs + dialog plugins      │  │ server/server.js  (node:http)   │
│ runs inside the webview        │  │ server/store.js   (node:fs)     │
└──────────────┬─────────────────┘  └─────────────┬───────────────────┘
               │                                  │
               └───────────────┬──────────────────┘
                               ▼
        ┌──────────────────────────────────────────────┐
        │  src/lib/workbook.js — THE SHARED CORE       │
        │  parseWorkbook · buildWorkbook                │
        │  validateInvoice · normalizeClient            │
        │  mutations{create,update,delete,client,…}     │
        │  pure: bytes in, bytes out, no filesystem     │
        └──────────────────────┬───────────────────────┘
                               ▼
                   Invoice Tracker.xlsx  +  backups/
```

The important line in that diagram is the shared core. Everything above it is
presentation; everything below it is bytes on a disk. The rules of the spreadsheet live
in exactly one place.

## 2. Why two shells

The desktop build is the product. The browser build exists because building the desktop
app needs Rust and MSVC build tools, and there must be a way to run FinanceOS on a
machine where those cannot be installed.

The naive way to support both is to write the ledger logic twice — once in Rust for the
desktop, once in JavaScript for the server. That guarantees the two drift apart, and the
divergence shows up as a wrong number in a financial record.

Instead: **SheetJS runs in the webview.** Tauri's `fs` plugin hands the JavaScript layer
raw bytes and takes raw bytes back, so the same parsing and writing code runs in both
builds. The Rust side is twelve lines and holds no business logic at all:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
```

| | Desktop | Browser |
|---|---|---|
| Window | Native (WebView2 / WKWebView) | Edge in app mode |
| Data path | webview → Tauri fs plugin → disk | webview → HTTP → `node:fs` → disk |
| Sockets | None | `127.0.0.1:4321` |
| Workbook location | Chosen via file picker, remembered | `LEDGER_FILE` or beside the app |
| Requires | Nothing (once installed) | Node.js LTS |
| Distribution | NSIS/MSI installer, ~12 MB | Repo + `FinanceOS.cmd` |

## 3. Module map

```
src/lib/workbook.js     The spreadsheet contract. Column mapping, coercion, date
                        encoding, validation, mutations. Pure. ~420 lines.
src/lib/derive.js       Everything computed from the raw rows: currency conversion,
                        aging, totals, monthly series, client statistics, next
                        invoice number. Pure.
src/lib/format.js       Presentation of dates and money. Pure.
src/lib/exporters.js    CSV, invoice PDF (jsPDF), reminder email text.
src/lib/api.js          Runtime shell selection.
src/lib/desktop.js      Tauri IO: read, atomic write, snapshot, workbook picker.

server/store.js         Node IO: read, atomic write, snapshot. 39 lines.
server/server.js        node:http. Six routes, static file serving, error mapping.
server/store.test.js    35 assertions. `npm test`.

src/App.jsx             State root: loads data, holds route and display currency,
                        builds the `ctx` object, owns drawers/toasts/palette.
src/components/         Topbar, RowMenu, three drawers, CommandPalette, Welcome, ui.
src/screens/            Workspace (home), InvoiceDetail, Collections, Clients,
                        ClientProfile, Payments, Reports, Settings.
src/styles.css          All styling; design tokens at the top.

src-tauri/              Window, plugins, capabilities, icons, bundle config.
```

## 4. Data flow

### 4.1 Reading

```
load → shell reads file bytes → parseWorkbook(bytes)
     → { invoices, clients, settings }
     → decorate(invoices, rates, displayCurrency)
     → derived fields: status, overdueDays, base, receivedBase, taxBase, …
     → screens render
```

`decorate` is the only place `Overdue` comes into existence, and it happens on every
render pass. There is no stored status that can be wrong tomorrow morning.

### 4.2 Writing

```
user action
  → ctx.saveInvoice(no, body)
  → api.updateInvoice → shell
      → read current bytes          ← re-read, not cached state
      → parseWorkbook
      → mutations.updateInvoice     ← validation happens here
      → buildWorkbook(data, existingBytes)
      → snapshot current file into backups/
      → write temp file, rename over target   ← atomic
      → read back
  → App.setData(fresh dataset)
  → toast
```

Four properties fall out of this ordering:

1. **No stale writes.** A hand edit made in Excel between two clicks survives, because
   the mutation is applied to what is on disk now, not to what the browser loaded.
2. **No partial writes.** The rename is atomic; a crash leaves the old file intact.
3. **No lost history.** The snapshot precedes the write.
4. **No drift.** The interface renders what came back from disk, not what it hoped it
   wrote.

The cost is a full parse-and-serialise per action — a few milliseconds at this scale,
and the honest trade for correctness. See ADR-4.

## 5. State ownership

| State | Lives in | Persisted |
|---|---|---|
| Invoices, clients, settings | The workbook | Yes — it *is* the database |
| Display currency | `App.jsx` `useState` | No: a view choice, resets to the workbook base |
| Route (screen + params) | `App.jsx` `useState` | No |
| Drawer / palette / toast | `App.jsx` `useState` | No |
| Filters, sort, search | `Workspace.jsx` `useState` | No |
| Analytics panel open | `localStorage` | Yes — a preference, not data |
| Chosen workbook path (desktop) | `localStorage` | Yes — a pointer, not data |

Nothing in the first row is ever mirrored into React state as a source of truth. The
`ctx` object is rebuilt from the last known-good read.

### The `ctx` object

Every screen receives one prop. It carries the decorated data, the display-currency
controls, navigation, and every action:

```js
{ all, list, clients, settings, base, ledgerBase, currencies, rates, file,
  route, go, fire, isDesktop,
  setBase, openPalette, newInvoice, editInvoice, recordPayment, editClient,
  chooseLedger, saveInvoice, duplicateInvoice, deleteInvoice, saveClient, saveSettings }
```

This is deliberately a plain object rather than a context provider or a store library:
one file constructs it, one prop passes it, and there is no indirection to trace when a
number looks wrong.

## 6. Error handling

| Condition | Behaviour |
|---|---|
| Validation failure | `400` / thrown error with a list of human-readable reasons; nothing written |
| Duplicate invoice number | `409`; nothing written |
| Invoice not found | `404` |
| Workbook open in Excel | `423` (or equivalent thrown error) with the filename and the remedy |
| Workbook missing (desktop) | Picker offered; no silent replacement created |
| Anything else | `500`, logged to the server console, surfaced as an error toast |

Every failure path leaves the workbook untouched and tells the user in one sentence what
to do. There are no silent retries — a locked file gets a clear message, not a loop.

## 7. Architecture decisions

### ADR-1 — Excel as the database

**Context.** The owner keeps, trusts and wants to keep a spreadsheet. Any migration to a
"real" database makes the spreadsheet a stale export.

**Decision.** The workbook is the system of record. No shadow database, no cache.

**Consequences.** Zero migration and zero lock-in; Excel remains a first-class view.
Costs: no concurrency, no row history, whole-file rewrites, and an exclusive-lock
failure mode while the file is open. Mitigated by single-writer design, atomic writes
and rolling snapshots.

**Reversal path.** Swap `parseWorkbook`/`buildWorkbook` for SQLite behind the same
function signatures, keeping the workbook as a generated export. No screen changes.

### ADR-2 — One shared core, two thin shells

**Context.** Two runtimes, one set of financial rules.

**Decision.** All mapping, validation and mutation logic is pure JavaScript in
`src/lib/workbook.js`, driven by both shells. SheetJS runs in the webview on desktop.

**Consequences.** The builds cannot disagree. Rust holds no logic, so no Rust knowledge
is needed to change behaviour. Cost: parsing happens in the webview, so a very large
workbook competes with the UI thread — acceptable at this scale.

### ADR-3 — Derived status, never stored

**Context.** The original sheet had a "Due by (days)" column that was stale on arrival.

**Decision.** Only facts are stored (`Received` / `Outstanding`, dates, amounts).
`Overdue`, days late, aging and all totals are computed at read time.

**Consequences.** The ledger cannot rot. A file untouched for six months reports
correctly the day it is opened. Legacy values like `Pending` collapse to `Outstanding`
on read, converging the file on one vocabulary.

### ADR-4 — Read-modify-write per action

**Context.** A user may edit the workbook in Excel while the app is open.

**Decision.** Every mutation re-reads the file, applies the change, writes, and re-reads.

**Consequences.** Concurrent hand-edits survive. Cost: a full parse/serialise per
action. Measured in milliseconds here; revisit above ~50,000 rows.

### ADR-5 — Hand-rolled Excel date serials

**Context.** SheetJS writes `Date` objects ten seconds past midnight and reads them back
a few seconds short of it, which shifts the calendar day across timezones.

**Decision.** Dates are ISO strings in memory. On write, `stampDates` converts the three
date columns to whole-day serial numbers with a `yyyy-mm-dd` number format. On read, a
one-minute nudge plus local calendar parts recovers the day.

**Consequences.** Dates survive round trips exactly, in any timezone, and Excel still
sees real dates it can sort and subtract. Verified by assertions in `store.test.js` —
change this code and run the tests.

### ADR-6 — No network, ever

**Context.** "Local only" that fetches fonts from a CDN is not local only.

**Decision.** Fonts are self-hosted (80 KB in `public/fonts/`); the desktop CSP allows
`self` only; exchange rates are entered by hand.

**Consequences.** Works offline, on a plane, behind any firewall. No third party learns
the business's billing cadence. Rates require manual upkeep — which is also correct for
an auditable ledger: a recorded figure must not change because a market moved.

### ADR-7 — Display currency converts, never filters

**Context.** Version 2.0.0 initially shipped the currency selector as a filter, which
hid invoices and understated totals.

**Decision.** The display currency restates every figure through the base currency. A
separate control on the ledger filters by invoice currency.

**Consequences.** Two clearly-labelled controls instead of one ambiguous one.
`convert()` is the single conversion path, covered by tests.

### ADR-8 — One page for the daily loop

**Context.** The redesign's nine screens looked good but made routine work — scan, find,
act — a navigation exercise.

**Decision.** `Workspace` merges the dashboard and the ledger; per-row actions (edit,
duplicate, record payment, PDF, delete) happen in place. Separate screens must earn
their room. Edits return you to where you started.

**Consequences.** Depth is available but never on the critical path. New features
default to the row menu or a drawer, not a new tab.

## 8. Build and distribution

```
npm run build          Vite → dist/            (both shells consume this)
npm run desktop:build  Vite → dist/ → Tauri → src-tauri/target/release/bundle/nsis/
npm start              Vite → dist/ → node server/server.js on :4321
npm run desktop        Vite dev server + Tauri window, hot reload
npm run dev            Vite dev server on :3000, /api proxied to :4321
npm test               node server/store.test.js
```

Dependencies are deliberately few: React, SheetJS, jsPDF, and the three Tauri packages.
No state library, no component library, no CSS framework, no test framework.

## 9. Security posture

- No authentication, because there is no remote surface to authenticate to.
- Browser mode binds to loopback only.
- Desktop filesystem access is scoped by Tauri capabilities to the user's home,
  documents, desktop and downloads directories.
- CSP permits `self` origins only; no external scripts, styles, fonts or images.
- Input is validated at the boundary in both shells before it can reach the workbook.
- Request bodies are capped at 2 MB.

The realistic threat model is not an attacker — it is data loss. That is what the atomic
writes, the snapshots and the round-trip tests are defending.
