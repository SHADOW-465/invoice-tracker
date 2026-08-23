# AGENTS.md — working in this repo

## What this is

A local-only receivables ledger. React UI and **one Excel workbook as the database**,
shipped two ways: a Tauri desktop app (no sockets) and a browser build behind a small
Node server on `127.0.0.1`. There is no cloud service, no auth, no multi-user story —
do not add one.

Read `README.md` first; it is the user-facing truth about how this runs and where the
data lives. Then, depending on what you are changing:

| Changing | Read first |
|---|---|
| Column mapping, dates, validation | [docs/data-model.md](docs/data-model.md) |
| Any calculation | [docs/financial-logic.md](docs/financial-logic.md) |
| Where a feature belongs, screen behaviour | [docs/ui-spec.md](docs/ui-spec.md) |
| Structure, or anything hard to reverse | [docs/architecture.md](docs/architecture.md) — the ADRs record *why* |
| Adding a requirement | [docs/SRS.md](docs/SRS.md) — number it, make it testable |
| Scope arguments | [docs/PRD.md](docs/PRD.md) §6 lists what is deliberately not built |

Keep the docs current in the same commit as the change. A wrong document is worse than
no document.

## Two shells, one set of rules

`src/lib/workbook.js` is the whole spreadsheet contract: column mapping, coercion,
validation and the mutations. It is pure — bytes in, bytes out, no filesystem. Two
shells drive it:

- **Desktop (Tauri)** — `src/lib/desktop.js`, reading and writing through the fs plugin.
- **Browser** — `server/store.js` + `server/server.js`, through `node:fs`.

`src/lib/api.js` picks the shell at runtime; screens never know which. Put ledger logic
in `workbook.js`, or it will exist in one build and not the other.

The Rust side in `src-tauri/` holds no business logic on purpose: window, dialog, fs.

## Layout

```
FinanceOS.cmd            Browser-mode launcher (build if needed, serve, open window)
Invoice Tracker.xlsx     The database. First sheet = invoices, plus Clients + Settings
backups/                 Last 30 pre-write snapshots (gitignored)
src-tauri/               Desktop shell: window, dialog, fs plugin, icons, capabilities
server/
  store.js               node:fs shell over src/lib/workbook.js
  store.test.js          Round-trip + conversion self-check — `npm test`
  server.js              node:http. Six REST routes + static dist/
src/
  lib/workbook.js        THE spreadsheet contract. Shared by both shells
  lib/desktop.js         Tauri fs shell and workbook picker
  lib/api.js             Runtime choice between the two shells
  lib/format.js          Money, dates, compact currency notation
  lib/derive.js          Every derived number: conversion, aging, totals, client stats
  lib/exporters.js       CSV, invoice PDF, reminder email text
  components/            Topbar, drawers, row menu, command palette, primitives
  screens/               One file per screen, all fed by the same `ctx` object
                         Workspace.jsx is home: KPIs + analytics + the ledger
  styles.css             All styling. Design tokens at the top
```

## Rules that matter

**The workbook is the source of truth.** Nothing is cached in `localStorage`, and no
state lives only in React. Every mutation is a read-modify-write on the file, and the
UI re-reads after each one. If you find yourself caching invoices client-side to avoid
a round trip, stop — correctness over a few milliseconds.

**One writer per shell, always snapshot-then-rename.** `writeAll` (Node) and
`writeData` (desktop) both back the file up before writing and rename a temp file into
place. Never open the workbook for writing anywhere else.

**Statuses on disk are `Received` or `Outstanding` only.** `Overdue` is derived from
the due date at read time (`decorate` in `derive.js`) so it can never go stale in the
sheet. Legacy values collapse to `Outstanding` on read.

**Dates are ISO `YYYY-MM-DD` in memory, whole Excel serials on disk.** `stampDates`
handles the conversion by hand — SheetJS's own Date handling lands ten seconds past
midnight and drifts a day across timezones. If you touch date handling, run `npm test`;
it asserts both directions.

**Workspace first, deep screens second.** The single page carries the daily loop —
scan the numbers, find the invoice, act on it — and every row action (edit, duplicate,
record payment, PDF, delete) happens in place without navigating. A separate screen has
to earn itself by needing the room: collections, client profiles, payments,
reports, invoice detail. When adding a feature, the default home is the row menu or a
drawer on the Workspace, not a new tab.

**Currency has two meanings — keep them apart.** The display currency (`ctx.base`)
re-expresses every total through `convert()`; it never filters. Filtering by invoice
currency is a screen-local concern and belongs on the Invoices screen. Conflating the
two was a real bug once; do not reintroduce it.

**Validate before anything reaches the workbook.** A bad row written to the workbook is a bad row
forever. `validateInvoice` in `workbook.js` is the gate, and both shells go through it.

**Excel holds an exclusive lock on an open workbook.** Both shells turn the resulting
`EBUSY`/`EPERM`/access-denied into one plain-English message naming the file. Keep it
that way; do not retry in a loop.

**No network requests, ever.** Fonts are self-hosted in `public/fonts/` and the desktop
CSP blocks outside origins outright. Do not add a CDN link, an analytics call, or a
live FX-rate fetch — rates are entered by hand in Settings on purpose, so a figure in
the ledger never changes because a third party moved.

## Design

Light only, deliberately — this is a ledger and it reads like paper. Tokens live at the
top of `src/styles.css`; `DESIGN.md` explains the palette. Numbers are tabular and
right-aligned, currency amounts are monospace, status colour is semantic
(emerald/slate/rose) and used nowhere decorative.

## Adding a second business app

Copy the repo, point `BOOK` at a different workbook, change the port, write a new
`.cmd`. Do not build a plugin system or a shared framework for apps that do not exist
yet — two independent copies are cheaper to run and safer to break.

## Checks

`npm test` covers the workbook round trip, legacy-sheet parsing and date serials. Add
to it when you change the mapping. There is no component test suite and none is wanted;
verify UI changes by running the app.
