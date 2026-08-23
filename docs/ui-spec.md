# Interface Specification — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

Screen-by-screen behaviour. The visual system — palette, type, spacing, motion — is in
[`../DESIGN.md`](../DESIGN.md); this document is about structure and interaction.

---

## 1. Information architecture

```
Top bar  ·  Workspace | Collections | Clients | Payments | Reports  ·  ⌘K  ·  currency  ·  + New Invoice  ·  ⚙
│
├── Workspace  (home)                    KPIs → analytics (collapsible) → the ledger
│   └── Invoice detail                   timeline, breakdown, documents
├── Collections                          overdue / due soon / recently collected
├── Clients                              table of billing relationships
│   └── Client profile                   history + payment behaviour
├── Payments                             receipts with withholding separated
├── Reports                              six scoped CSV exports
└── Settings                             workspace, rates, documents, data
```

### The rule that decides where a feature goes

**The daily loop lives on one page.** Scan the numbers, find the invoice, act on it —
all without navigating. Every row action happens in place, and editing returns you to
where you started.

**A separate screen must earn its room** by needing space the ledger row cannot give:
a chasing session (Collections), one client's whole history (Client profile), receipt
reconciliation (Payments), export configuration (Reports), a document (Invoice detail).

New features default to the row menu or a drawer on the Workspace. A new tab is the
exception and needs an argument.

---

## 2. Top bar

Sticky, 58 px, translucent with a hairline. Full width — the reason it replaced a
sidebar is that a dense ledger wants the horizontal space.

| Zone | Contents |
|---|---|
| Left | Mark + `FinanceOS` + workspace name (click → Workspace) |
| Centre-left | Five tabs. Active tab filled; a rose dot on Collections when anything is overdue |
| Right | Search trigger (`⌘K`), display-currency segmented control, **+ New Invoice**, settings, avatar |

Detail screens keep their parent tab lit: Invoice detail → Workspace, Client profile →
Clients.

Below 1280 px the search label and workspace name drop. Below 1100 px the bar wraps to
two rows with the right-hand group on its own line.

---

## 3. Workspace — the home screen

Three stacked bands.

### 3.1 KPI strip

Five equal cells in one bordered card: **Total Invoiced · Collected · Outstanding ·
Overdue · Collection Rate**. Each shows a label, the value in the display currency, and
one line of supporting context (invoice count, last receipt date, oldest overdue,
median days to pay). Overdue turns rose when non-zero.

Two columns below 1100 px.

### 3.2 Analytics — collapsible

Toggled by **Show/Hide analytics** in the page header; the choice persists in
`localStorage`. Hidden, the ledger sits directly under the KPIs — which is the common
case once you know your numbers.

**Invoiced vs Collected** (≈ 62 % width) — grouped bars per month, ranges 6M/12M/24M,
metric Amount/Invoices, five gridlines, hover tooltip showing invoiced, collected and
collection rate for the month. Bars shrink from 16 px as months are added; labels thin
to every second or third month; the tooltip is clamped inside the card at both ends.

**Receivables Aging** (≈ 38 % width) — proportional stacked bar plus five rows with
count, share and amount. The 90+ row is rose when it holds anything.

**Needs Your Attention** (full width) — up to four overdue invoices, worst first, each
with a priority rail, amounts in both currencies, days late, and **Record Payment** /
open. Links to Collections for the full list. Empty state: *No overdue invoices — you're
all caught up.*

### 3.3 The ledger

**Toolbar:** search · status segments (All / Received / Outstanding / Overdue) ·
currency · month · client · Clear (whenever any filter is set) · count and running total
of the rows on screen.

**Columns:** Invoice · Client · Amount · Raised · Due · Status · Payment · `⋯`

- Six of the seven headers sort, ascending/descending, arrow-marked.
- Amount shows the invoice currency first, the converted equivalent beneath.
- Client shows remarks as a second line when present.
- Overdue rows show days late under the badge and a rose due date.
- Row click or `Enter` opens the invoice.

**Row menu (`⋯`)** — the feature set that makes the page self-sufficient:

| Item | Behaviour |
|---|---|
| Open | Invoice detail |
| Edit invoice | Drawer, all fields including status |
| Record payment | Drawer (outstanding invoices only) |
| Duplicate | New invoice, next number, today, unpaid |
| Download PDF | Saves the A4 invoice |
| Copy reminder | Reminder email to the clipboard |
| Delete | Two-step: the item becomes *Click again to confirm* |

The menu closes on outside click or `Escape`.

**Responsive columns.** A dense table cannot simply shrink, so it sheds its least
load-bearing column at each breakpoint rather than pushing the page sideways:

| Width | Dropped |
|---|---|
| ≤ 1180 px | Payment method |
| ≤ 980 px | Due date |
| ≤ 760 px | Raised date and the Invoice column — the number moves under the client name |

---

## 4. Invoice detail

Back link → Workspace. Header: invoice number, status badge, client (links to profile),
invoiced month.

**Actions:** Record Payment (outstanding only) · Edit Invoice · Duplicate · Download PDF ·
Copy Reminder · Delete (two-step).

**Left column** — the amount in large type, the currency, and the conversion line
showing the rate used. Beneath it a three-step timeline: Invoice Raised → Payment Due →
Payment Received, each with date and a note (terms, days past due, days taken to
collect). Completed steps are filled. Remarks appear in their own card when present.

**Right column** — two fact panels. *Invoice Details*: number, client, dates, terms,
method, currency, value in the display currency. *Payment*: withholding, amount
received, received date, status, and unreconciled balance (rose when non-zero).

---

## 5. Collections

Built for one chasing session.

Header carries three stats — Overdue, Due soon, Recently collected — and a four-stage
pipeline strip (Raised → Outstanding → Overdue → Collected) with counts.

Three grouped cards, each with a coloured dot, subtitle and group total:

| Group | Contents | Sort |
|---|---|---|
| Overdue | Past due | Most overdue first |
| Due Soon | Outstanding, not yet due | Earliest due date |
| Recently Collected | Last six settlements | Most recent receipt |

Each row: invoice and client, amount in both currencies, remarks or *Settled in full* /
*No notes yet*, days overdue or due-in, and Record Payment / View.

---

## 6. Clients and Client profile

**Clients** — one row per client: name with initials pill, total invoiced, collected,
outstanding (rose when non-zero, em dash when clear), invoice count, average days to
pay, and a five-pip behaviour meter with its label. Sorted by total invoiced.
**+ New Client** opens the client drawer.

**Client profile** — avatar, display name, and a meta line (invoice count, currencies
used, client since, email). Three summary cells: invoiced, collected, outstanding.

Left: full invoice history, newest first, each row opening the invoice. Right: payment
behaviour — average days to pay in large type, an eight-pip meter, a plain-English
reading, then fastest, slowest, on-time rate, preferred method, default terms, and
standing withholding when set. Client notes at the foot.

---

## 7. Payments

Every receipt, newest first, with the deductions made explicit.

Three stats: collected, tax withheld, unreconciled shortfall (rose when non-zero).

Columns: Invoice · Client · Invoiced · Withheld · Received · Received On · Method.
Withheld shows amber and negative when present, an em dash otherwise. Where cash
received differs from amount minus withholding, a rose sub-line reads *short $X* or
*over $X* — the number that would otherwise be invisible.

**Record Payment** here opens the drawer with an invoice picker.

---

## 8. Reports

Filter row: period (6/12/24 months), client, display currency, and a count of invoices
in scope. Six cards — Revenue, Collections, Outstanding Receivables, Aging, Client
Performance, Payment Timeliness — each showing a headline figure, a one-line
description, and a sparkline. Clicking a card exports that report as CSV and confirms
with a toast naming the row count.

---

## 9. Settings

Four sections, one save button in the header that enables only when something changed.

1. **Workspace** — name, billing email, tax ID, invoice prefix, base currency, default
   payment terms. Each row pairs a label and a one-line explanation with its control.
2. **Exchange Rates** — a card per currency, showing `XXX / BASE`. The base currency's
   own field is disabled at 1.
3. **Invoice Document** — address block and bank/payment instructions, both multi-line,
   both used on PDFs and reminders.
4. **Data** — the absolute workbook path, invoice and client counts, the backup policy,
   and (desktop only) **Choose workbook…** to point at a different file.

---

## 10. Drawers

All editing happens in a 460 px right-hand drawer over a scrim, never a centred modal —
the ledger stays visible behind the work. `⌘↵` saves, `Escape` or the scrim closes.

### Invoice drawer (new / edit)

Invoice number · Client (with datalist; a new name creates the client) · Amount ·
Currency · Raised on · Payment terms · Due date (computed, read-only) · Payment method ·
Withholding % · **Collection status** · Received on + Amount received (when Received) ·
Remarks.

- Choosing a known client prefills their currency, terms and standing withholding.
- The withholding hint states the deduction and resulting net in cash terms.
- Switching status to **Received** fills in today's date and the expected net; switching
  back to **Outstanding** clears both, so a mistaken payment leaves nothing behind.
- The hint explains that Overdue is derived and cannot be set by hand.
- Saving keeps you where you were; only the detail screen follows the invoice, and only
  because a renumber would strand its route.

### Payment drawer

Invoice picker (defaults to the row you came from) · Withholding % · Amount received ·
Received on · Payment method · Notes, above a live **Reconciliation** panel: invoice
amount, withholding, amount received, difference, and a sentence classifying the result
(full settlement / exactly the withholding / unexplained shortfall with its size and
percentage).

Editing the withholding recalculates the expected receipt.

### Client drawer

Ledger name (renaming cascades to every invoice) · Display name · Billing email ·
Default currency · Default terms · Standing withholding % · Notes.

---

## 11. Command palette

`Ctrl/⌘+K`, or the top-bar search trigger. Fuzzy-free substring matching across:

| Kind | Matches |
|---|---|
| Page | All seven destinations |
| Invoice | Number or client name (max 6), amount shown on the right |
| Client | Name or display name (max 4) |
| Action | *New invoice* |

Arrow keys move, `Enter` selects, `Escape` or a scrim click closes. Empty result:
*Nothing matches "…"*.

---

## 12. Feedback, states and keyboard

**Toasts** — bottom centre, 3.2 s, `role="status"`. Success is ink; errors are deep rose
and carry the full message (validation reasons, or *The workbook is open in Excel.
Close "Invoice Tracker.xlsx" and try again.*).

**Loading** — *Opening the ledger…* centred. On failure it names the reason.

**First run (desktop)** — a Welcome screen explaining that the workbook stays where it
is, a **Choose workbook…** button, and the expected columns. No empty ledger is ever
created behind your back.

**Empty states** — every list has one, and each says what to do next rather than just
reporting emptiness.

**Destructive actions** — always two-step, labelled *Click again to confirm*.

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘↵` / `Ctrl+↵` | Save the open drawer |
| `Esc` | Close drawer, menu or palette |
| `Tab` | Move through fields; focus ring always visible |
| `Enter` | Open the focused ledger row |
| `↑` `↓` | Move through palette results |

**Accessibility.** Body text meets WCAG AA; focus rings are never removed; the currency
control and row menus carry `aria` labels and expanded state; toasts announce through a
live region; all motion collapses under `prefers-reduced-motion`.
