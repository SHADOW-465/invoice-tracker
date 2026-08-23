# Testing — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

---

## 1. Philosophy

This is a two-person-hours-a-week business tool with one user, not a platform. The
testing effort goes where a defect would be *expensive and silent*:

- **Money and dates written to the workbook.** A wrong figure or a date off by one is
  invisible until an accountant finds it. Fully covered by automated checks.
- **The workbook round trip.** Anything the app writes must come back identical.
- **Legacy parsing.** The original hand-kept sheet must keep working forever.
- **Currency conversion.** Ratios must not depend on the display currency.

Everything visual is verified by looking at it. There is deliberately **no component
test suite and no test framework** — `npm test` is one Node file using `node:assert`,
which is why it finishes in about a second and nobody has an excuse to skip it.

---

## 2. Automated checks

```bash
npm test          # node server/store.test.js — 35 assertions
```

Runs against a throwaway workbook in the system temp directory. **It never touches your
ledger.** Exit code 0 and one line of output, or a failed assertion naming exactly what
broke.

### Coverage

| Group | Asserts |
|---|---|
| **Round trip** | Every invoice field survives write→read identically; client defaults survive; settings survive; exchange rates survive |
| **Dates** | Raised and received dates hold exactly; both land on **whole-day** Excel serials (no time component); `today()` follows the local calendar, not UTC |
| **Legacy sheet** | Original headers with embedded newlines parse; Excel serials become ISO dates; a received date implies `Received`; `Pending` collapses to `Outstanding`; withholding is recovered from remarks text; tax amount and net are computed; due date defaults to Net 30; invoiced month is derived; clients are inferred from invoices; a legacy workbook survives a save without losing rows |
| **Status transitions** | Marking Received fills in a date; a zero receipt falls back to the expected net; reverting to Outstanding clears both the date and the amount |
| **Currency** | USD→INR uses the quoted rate; INR→USD is the exact inverse; cross rates pivot through base; same-currency is a no-op; switching display currency keeps every invoice; totals convert; **collection rate is identical in every currency** |

### When to run it

- Before every commit.
- **Always** after touching `workbook.js`, `derive.js` or anything date-related.
- After `git pull`, before building — a failing round-trip assertion on someone else's
  change means do not run the app against your ledger yet.

### Extending it

Add assertions to `server/store.test.js`. Keep the constraints: no framework, no
fixtures directory, a second or two end to end, never writes outside the temp directory.
Every bug found in the workbook mapping should leave an assertion behind — five of the
seven in §5 did, and the other two left QA steps.

---

## 3. Manual QA script

Run against a **copy** of the workbook, not the live one:

```bash
set LEDGER_FILE=%TEMP%\qa-ledger.xlsx
```

Full pass takes about fifteen minutes. IDs match the traceability column in
[SRS.md](SRS.md).

### Workspace

| # | Check | Expected |
|---|---|---|
| QA-1 | Open the app | Five KPIs, chart, aging, attention queue, ledger — all populated; figures match the sheet |
| QA-2 | Toggle **Hide analytics**, reload | Panel stays hidden; ledger sits directly under the KPIs |

### Invoice lifecycle

| # | Check | Expected |
|---|---|---|
| QA-3 | **+ New Invoice** | Number pre-filled with the next in series; due date follows terms and is read-only |
| QA-4 | Pick an existing client | Currency, terms and standing withholding prefill |
| QA-5 | Row menu → **Duplicate** | New invoice, next number, today's date, Outstanding, remarks read *Copy of …*; original unchanged |
| QA-6 | Row menu → **Edit invoice**, change status to Received | Received-on and amount-received appear, prefilled with today and the expected net; save; row shows Received; **you stay on the Workspace** |
| QA-6b | Edit the same invoice, set status back to Outstanding | Receipt fields disappear; after save the Payments screen no longer lists it |
| QA-7 | Row menu → **Delete** | First click arms (*Click again to confirm*), second deletes; row and totals update |
| QA-8 | Create an invoice reusing an existing number | Error toast naming the clash; nothing written |
| QA-8b | Save an invoice with a blank client and a negative amount | Both reasons in one error message; nothing written |

### Payments

| # | Check | Expected |
|---|---|---|
| QA-9 | **Record Payment**, set withholding 15 % | Amount received recalculates; reconciliation reads *Short by exactly the 15% withholding* |
| QA-9b | Type a received amount 100 below the expected net | Reconciliation names the unexplained portion and its percentage |
| QA-10 | Payments screen | Withheld column amber and negative; any mismatch shows a rose *short/over* sub-line; three stats agree with the rows |

### Currency

| # | Check | Expected |
|---|---|---|
| QA-11 | Switch display currency through every option | Every figure restates; **row count never changes**; collection rate identical throughout; each row keeps its own currency as the primary amount |
| QA-12 | Apply status + currency + month + client filters, search, sort each column | Count and running total track; **Clear** appears whenever a filter is set — including one that matches every row |

### Analysis

| # | Check | Expected |
|---|---|---|
| QA-13 | Chart: 6M/12M/24M × Amount/Invoices | Bars stay inside the card at every combination; axis whole numbers in Invoices mode; tooltip stays inside the card on the first and last columns |
| QA-14 | With the app open, edit a remark in Excel, save, close; then edit a *different* invoice in the app | Your Excel edit survives the app's save |
| QA-15 | Clients and a client profile | Totals reconcile with the ledger; average days, on-time rate and behaviour rating are plausible |

### Navigation and documents

| # | Check | Expected |
|---|---|---|
| QA-16 | `⌘K`; type part of an invoice number, a client name, and a page name | All three kinds appear; arrows move; `Enter` navigates; `Esc` closes |
| QA-17 | **Download PDF** | One A4 page: workspace details, client, amount, withholding, payment instructions |
| QA-18 | **Copy reminder**, paste into a text editor | Subject and body; status wording matches the invoice (overdue by N days / due on date / settled) |
| QA-19 | **Export CSV** from a filtered view | Only the filtered rows; both original and converted amounts; opens cleanly in Excel |
| QA-20 | Each of the six report cards | Downloads with a plausible row count; the toast names it |

### Settings and data

| # | Check | Expected |
|---|---|---|
| QA-21 | Change workspace name and a rate, save | Toast; totals restate; reopen the app and the change is still there; the `Settings` sheet in Excel shows it |
| QA-22 | Desktop: **Settings → Choose workbook…**, pick another file, restart | The new workbook loads and is remembered |
| QA-23 | Open the workbook in Excel, leave it open, save anything in the app | Error naming the file and telling you to close it; nothing lost; retry after closing succeeds |
| QA-24 | Open the workbook in Excel after a session | Dates are dates (sortable, subtractable), numbers are numbers, original columns intact, added columns populated |
| QA-25 | Check `backups/` | A new snapshot per save, at most 30 |

### Non-functional

| # | Check | Expected |
|---|---|---|
| QA-30 | Resize from 1440 px down to 1024 px | No horizontal page scroll; ledger drops Payment, then Due; chart stays inside its card |
| QA-31 | Tab through a screen | Every control reachable, focus ring always visible |
| QA-32 | `Esc` from a drawer, a row menu, the palette | All close |
| QA-33 | DevTools → Network, exercise the app | No outbound requests to any external host, including fonts |

---

## 4. Pre-release checklist

```
[ ] npm test                     35 assertions pass
[ ] npm run build                completes clean
[ ] npm run desktop:build        installer produced
[ ] Manual QA script             full pass on a copied workbook
[ ] Workbook opened in Excel     dates and numbers intact
[ ] DevTools Network             zero external requests
[ ] Version bumped               package.json + src-tauri/tauri.conf.json + Cargo.toml
[ ] docs/ reviewed               anything this release changed
```

---

## 5. Regression log

Bugs found in production behaviour, and the check that now prevents each. Every one of
these was silent — none announced itself with an error.

| Bug | Effect | Now caught by |
|---|---|---|
| SheetJS date drift | `46028` read back as 05 Jan instead of 06 Jan; every date a day early east of Greenwich | Round-trip date assertions |
| Ten-second date serials | Excel showed a time component on every date; sheet formulas inherited the fraction | Whole-serial assertions |
| `today()` from UTC | Between midnight and 05:30 IST the app believed it was yesterday — receipts dated a day early, overdue counts wrong | Local-calendar assertion |
| Currency control filtered instead of converting | Selecting USD hid every non-USD invoice and understated totals | Conversion assertions (row count preserved, ratios stable) |
| Zero receipt on manual status change | Marking an invoice Received by hand recorded a receipt of 0, understating collections | Marked-received assertions |
| Chart overflow | 24 months of bars painted outside the card and over the next one | QA-13, QA-30 |
| Clear-filters hidden | A filter matching every row left no way to clear it | QA-12 |

The pattern is worth naming: **every one of these was a silent wrong number, not a
crash.** That is the failure mode this application has to defend against, and it is why
the automated checks live at the workbook boundary rather than on the components.
