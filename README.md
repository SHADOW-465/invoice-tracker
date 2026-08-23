# FinanceOS — Invoice Ledger

A local receivables ledger for one laptop. The interface is the FinanceOS design; the
database is your existing `Invoice Tracker.xlsx`. No cloud, no account, no sync. The
desktop build opens no sockets at all; the browser build listens on `127.0.0.1`, which
nothing outside this machine can reach. Fonts are bundled, so it works with the wifi off.

## Run it

Two ways to run the same app. Same screens, same rules, same workbook.

### A. Desktop app (recommended) — a real installed program

Tauri wraps the interface in a native window. No browser, no localhost, no console
window: an installer, a Start-menu entry, a taskbar icon, around 12 MB.

Build it once:

```bash
npm run desktop:build
```

The installer lands in `src-tauri/target/release/bundle/nsis/`. Run it and FinanceOS is
installed like any other program. On first launch it asks which workbook to use — point
it at your `Invoice Tracker.xlsx` wherever it lives, and it remembers.

Building needs, one time only:

- [Rust](https://rustup.rs) — run `rustup-init.exe` and accept the defaults.
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  with the *Desktop development with C++* workload (Rust needs the MSVC linker).
- WebView2, already present on Windows 11.

The first build takes a few minutes while Rust compiles; later ones are quick. For
development with hot reload, `npm run desktop`.

### B. Browser mode — nothing to install but Node

Double-click **`FinanceOS.cmd`**. First run installs dependencies and builds the
interface; after that it opens in seconds in a chromeless Edge window. Close the console
window to stop it. Requires [Node.js](https://nodejs.org) (LTS).

Useful on a machine where you cannot install the Rust toolchain.

## Documentation

Full reference lives in [`docs/`](docs/README.md): product requirements
([PRD](docs/PRD.md)), the numbered requirements spec ([SRS](docs/SRS.md)),
[architecture](docs/architecture.md) and its decision record, the workbook
[data model](docs/data-model.md), every formula in [financial logic](docs/financial-logic.md),
the [interface spec](docs/ui-spec.md), [operations](docs/operations.md) and
[testing](docs/testing.md).

## Currencies

Two different controls, deliberately:

- **"Show in" (Overview, Reports)** changes the currency every total is *expressed* in.
  Switch it to USD and the whole dashboard restates itself in dollars — nothing is
  hidden, no invoice drops out. Conversion pivots through the workbook base currency
  using the rates on the Settings sheet.
- **The currency dropdown on Invoices** is a genuine filter: show only the GBP invoices.

Each invoice always shows its own currency as the primary figure with the converted
equivalent underneath, so the original amount is never obscured.

## Where your data lives

| What | Where |
|---|---|
| Invoices | `Invoice Tracker.xlsx` → first sheet |
| Clients | `Invoice Tracker.xlsx` → `Clients` sheet |
| Settings & FX rates | `Invoice Tracker.xlsx` → `Settings` sheet |
| Snapshots | `backups/` beside the workbook — the last 30 saves, taken before every write |

The workbook is the source of truth, not a copy of it. Open it in Excel whenever you
like; the app re-reads it on every action, so edits you make by hand show up
immediately. **Close the workbook in Excel before saving from the app** — Windows
gives Excel an exclusive lock, and the app will tell you so rather than losing a write.

Your original columns are preserved. Four are added on first save (`Due Date`,
`Term Days`, `Tax %`, `Tax Amount`, `Amount Received`) so that withholding and
reconciliation stop living inside the remarks text.

To keep the ledger somewhere else — OneDrive, a NAS folder — set `LEDGER_FILE`:

```bash
set LEDGER_FILE=D:\Business\Invoice Tracker.xlsx && FinanceOS.cmd
```

## Is Excel-as-database a good idea?

For one person and a few thousand invoices, yes, and it is what makes this thing
worth having: you keep Excel for the things Excel is good at, and get a real
interface for the things it is bad at. The guardrails that make it safe:

- **One writer.** A single code path writes the file, and only through `writeAll`.
- **Atomic saves.** Written to a temp file and renamed, so a crash mid-save can never
  leave you with a truncated workbook.
- **A snapshot before every write**, thirty deep.
- **Read-modify-write per action**, so a change you made in Excel between two clicks is
  never silently overwritten by stale state in the interface.

What it does not give you: concurrent writers, row-level history, or fast queries over
hundreds of thousands of rows. If you ever hit those, the swap is SQLite behind the
same API with the workbook kept as an export — the UI would not change.

## The rest of the business apps

This repo is deliberately shaped to be copied. A second tool — expenses, purchase
orders, timesheets — is the same three pieces:

- `src/lib/workbook.js` — the workbook mapping and rules. The only part that really changes.
- `src/lib/desktop.js` + `server/` — the two thin IO shells. Usually untouched.
- `src/screens/` — screens over a single `ctx` object.

Copy the folder, rewrite the column mapping, change `productName` and `identifier` in
`src-tauri/tauri.conf.json`, and build. Each app stays independently installable and
independently breakable, which is the point — resist building a shared framework for
apps that do not exist yet.

## Development

```bash
npm run desktop        # Tauri window with hot reload (needs Rust)
npm run desktop:build  # produce the installer
npm run dev:server     # ledger API on :4321, restarts on change
npm run dev            # Vite UI on :3000, proxies /api
npm test               # workbook round-trip + currency conversion self-check
npm start              # build and serve browser mode on :4321
```

The spreadsheet rules live in `src/lib/workbook.js` and nowhere else. The Node server
and the desktop build are both thin shells around it — one talks to `node:fs`, the other
to the Tauri filesystem plugin — so the two builds cannot drift apart.

Fonts are self-hosted in `public/fonts/`. The app makes no network requests at all.

## Keyboard

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette — jump to any screen, invoice or client |
| `⌘↵` / `Ctrl+↵` | Save the open drawer |
| `Esc` | Close drawer or palette |

## What it does

A top bar and one working page, with deeper screens for the jobs that earn their own room.

### Workspace — the page you live on

Everything the daily job needs, without navigating anywhere:

- **Five headline figures** — invoiced, collected, outstanding, overdue, collection rate.
- **Analytics, collapsible** — invoiced-vs-collected by month, receivables aging, and the
  overdue queue. Hidden with one click when you just want the ledger; the app remembers.
- **The ledger** — every invoice, sortable, with search and four filters (status,
  currency, month, client) and a running total of whatever is on screen.
- **A `⋯` menu on every row** — open, edit, record payment, **duplicate**, download PDF,
  copy a reminder, delete. All of it without leaving the page, and edits keep you here.

### The deeper screens

Reached from the top bar, or by clicking through from the ledger:

- **Invoice detail** — timeline from raised to paid, full breakdown, PDF, reminder,
  duplicate, edit, delete.
- **Collections** — overdue, due soon and recently collected, grouped for one chasing session.
- **Clients** — invoiced/collected/outstanding per client, average days to pay, and a
  payment-behaviour read; profiles carry the full invoice history.
- **Payments** — every receipt with withholding shown explicitly and any unexplained
  shortfall flagged rather than buried.
- **Reports** — six exports (revenue, collections, outstanding, aging, client
  performance, timeliness), scoped by period, client and currency.
- **Settings** — workspace details, invoice prefix, base currency, exchange rates, bank
  details. All stored in the workbook, not in the browser.

### Editing an invoice

The drawer edits everything, **collection status included**. Switch it to Received and
it fills in the date and the expected net; switch it back to Outstanding and the receipt
is cleared, so a payment logged by mistake leaves nothing behind in the payments ledger.
`Overdue` is never set by hand — it is worked out from the due date every time the
ledger is read, so it cannot go stale in the sheet.
