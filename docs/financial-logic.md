# Financial Logic — FinanceOS

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026

Every number the interface shows and how it is produced. Implementation:
[`src/lib/derive.js`](../src/lib/derive.js) and
[`src/lib/workbook.js`](../src/lib/workbook.js).

Worked examples use the live ledger (five invoices, base currency INR, rates
`USD 87.4`, `GBP 111.2`, `CHF 108.5`, `EUR 94.8`).

---

## 1. Currency conversion

Rates are quoted as **the value of one unit of a currency in the base currency**. The
base currency's rate is always 1.

```
convert(amount, from, to) = amount × rate[from] ÷ rate[to]
```

Conversion between two non-base currencies pivots through the base, which keeps cross
rates internally consistent — USD→GBP is always exactly USD→INR→GBP, so no total can
disagree with itself depending on the route taken.

**Worked example.** $3,381.95 with `USD 87.4`, `GBP 111.2`:

```
→ INR :  3381.95 × 87.4 ÷ 1     = ₹295,582.43
→ GBP :  3381.95 × 87.4 ÷ 111.2 = £2,658.12
→ USD :  3381.95 × 87.4 ÷ 87.4  = $3,381.95   (identity)
```

### Display currency vs invoice currency

Two distinct concepts, two distinct controls:

| | Display currency | Invoice currency filter |
|---|---|---|
| Where | Top bar, "Show in" | Ledger toolbar dropdown |
| Effect | Restates every total in the chosen currency | Shows only invoices billed in that currency |
| Changes the row set? | **Never** | Yes |
| Stored? | No — a view choice, resets to the workbook base | No |

Each invoice always displays its own currency as the primary figure, with the converted
equivalent beneath it, so the original amount is never obscured.

Ratios are currency-independent by construction: collection rate is 95.3 % whether the
ledger is shown in INR, USD, GBP or EUR. `store.test.js` asserts this.

### A note on precision

Conversion happens at read time from the current rates — the ledger does not store a
rate per invoice. Changing a rate therefore restates history. This is correct for a
management view ("what are we owed, in today's terms") and wrong for statutory
reporting, where the rate on the invoice date is what matters. If that ever becomes
necessary, the fix is a `Rate` column on the Invoices sheet, locked at raise time.

---

## 2. Aging and overdue

All of it derives from the due date and today's **local** calendar date.

```
dueDate      = raisedOn + termDays                    (default 30)
overdueDays  = status ≠ Received ? max(0, today − dueDate) : 0
daysToDue    = dueDate − today                        (negative once overdue)
status       = Received            if a receipt exists
             = Overdue             if outstanding and overdueDays > 0
             = Outstanding         otherwise
daysToCollect = receivedOn − raisedOn                 (null if unsettled)
```

Nothing here is stored. An invoice becomes overdue because a day passed, not because
anyone ran a job.

### Aging buckets

Outstanding invoices only, bucketed by `overdueDays`:

| Bucket | Range | Colour |
|---|---|---|
| Current | ≤ 0 (not yet due) | Slate `#41505F` |
| 1–30 days | 1–30 | Blue `#5C7FA8` |
| 31–60 days | 31–60 | Pale blue `#8FA9C6` |
| 61–90 days | 61–90 | Sand `#C8A96B` |
| 90+ days | > 90 | Rose `#A8382F` |

Each reports count, total in the display currency, and share of the outstanding balance.
Share is computed against total outstanding, with a floor of 1 to avoid dividing by
zero on an empty ledger.

### Attention priority

The overdue queue is sorted worst-first by `overdueDays`, with a colour rail:

| Days past due | Rail |
|---|---|
| > 60 | Rose — escalate |
| 21–60 | Amber — chase |
| ≤ 20 | Grey — watch |

---

## 3. Withholding tax (TDS)

Where a client deducts tax at source, the invoice is settled short **by design**. The
ledger separates that expected shortfall from an unexplained one.

```
taxAmount     = round2(amount × taxRate ÷ 100)
expectedNet   = amount − taxAmount
shortfall     = amount − amountReceived
unexplained   = |amount − amountReceived| − taxAmount
```

**Worked example — SnS02532.**

```
amount        = $3,381.95
taxRate       = 15 %
taxAmount     = 3381.95 × 0.15  = $507.29
expectedNet   = 3381.95 − 507.29 = $2,874.66
amountReceived= $2,874.66
unexplained   = |3381.95 − 2874.66| − 507.29 = $0.00   → fully reconciled
```

The reconciliation panel in the payment drawer classifies the result live:

| Condition | Message |
|---|---|
| `|difference| < 0.005` | *Full settlement. The invoice will be closed.* |
| `unexplained ≤ 0.01` | *Short by exactly the 15% withholding. Recorded as tax deducted at source.* |
| otherwise | *Short receipt of $X (Y %), of which $Z is beyond the declared withholding. Record the reason so the shortfall is auditable rather than buried in remarks.* |

Recording a withholding above zero appends a note to the remarks (`Received after 15%
tax deduction`) unless one for that rate is already present — so the sheet stays
readable to a human reading it in Excel, while the numbers live in their own columns.

### Recovery from legacy remarks

An invoice with no `Tax %` but a percentage in its remarks has the rate recovered on
read (see [data-model.md §9](data-model.md#9-withholding-recovery-from-remarks)). This
is how the pre-existing ledger produced correct withholding totals without re-keying.

---

## 4. Headline metrics

Computed by `totals()` over whatever list is in scope — the whole ledger, a filtered
view, or one client's invoices.

| Metric | Formula |
|---|---|
| Total invoiced | `Σ base` |
| Collected | `Σ receivedBase` |
| Outstanding | `Σ base` where status ≠ Received |
| Overdue | `Σ base` where status = Overdue |
| Tax withheld | `Σ taxBase` |
| Collection rate | `collected ÷ invoiced × 100` (0 when nothing invoiced) |
| Average days to collect | `mean(daysToCollect)` over settled invoices |
| Oldest overdue | `max(overdueDays)` |
| Open count | count where status ≠ Received |

`base`, `receivedBase` and `taxBase` are already in the display currency, so every
figure restates together when the currency changes.

**Worked example — the live ledger in INR.**

```
invoiced   = 5.96 L + 24,738 + 2.96 L + 15,743 + 13,989 = ₹9.46 L
collected  = same, less the ₹44,337 withheld on SnS02532 = ₹9.01 L
rate       = 9.01 ÷ 9.46 × 100 = 95.3 %
avg days   = (34 + 30 + 39 + 28 + 28) ÷ 5 = 32 days
outstanding= ₹0    (all five settled)
```

---

## 5. Monthly series

Invoices are grouped by the calendar month of the **raised** date, not the received
date — the chart answers "what did we bill, and how much of it came back", which needs
both series on the billing month.

```
monthKeys(list, n)  → the n months ending at the newest invoice (or this month)
byMonth(list, keys) → per month: invoiced, collected, count, collectedCount
```

Ranges of 6, 12 or 24 months; metric of amount or invoice count.

### Axis scaling

| Metric | Ceiling |
|---|---|
| Amount | Next power of ten above the peak, times the leading digit — `10^⌊log₁₀ p⌋ × ⌈p ÷ 10^⌊log₁₀ p⌋⌉` |
| Invoices | `max(4, ⌈peak ÷ 4⌉ × 4)` — a multiple of four so five gridlines land on whole numbers |

The invoice-count rule exists because dividing a peak of 5 into four gridlines produced
the nonsense axis 5 / 3.75 / 2.5 / 1.25, rounded for display to 5 / 4 / 3 / 1.

Bars are drawn at `value ÷ ceiling × 226 px`, floored at 2 px so a non-zero month is
never invisible. Month labels thin to every `⌈months ÷ 12⌉`-th when crowded.

---

## 6. Client statistics

Per client, over their invoices in the current display currency:

| Statistic | Formula |
|---|---|
| Invoiced / collected / outstanding | Sums of `base`, `receivedBase`, and `base` where unsettled |
| Average days to pay | `mean(daysToCollect)` over settled invoices; 0 if none |
| Fastest / slowest | `min` / `max` of `daysToCollect` |
| On-time rate | `count(receivedOn ≤ dueDate) ÷ count(settled) × 100` |
| Preferred method | Modal `paymentMode` |

### Behaviour rating

Evaluated in order — the first match wins:

| Rating | Condition | Pips | Reading |
|---|---|---|---|
| **New** | no settled invoices | 2 | No settled invoices yet. |
| **Prompt** | avg ≤ 32 days | 5 | Pays inside terms consistently. No escalation needed. |
| **Steady** | avg ≤ 42 days | 4 | Reliable, usually a few days past terms. |
| **Slow** | avg > 42 **and** outstanding > 0 | 2 | Requires follow-up. Consider shorter terms on the next contract. |
| **Late** | avg > 42, nothing outstanding | 3 | Settles eventually, but well past agreed terms. |

The thresholds are calibrated to Net 30 terms: 32 days allows a couple of days of
banking friction; beyond 42 is a fortnight late and worth acting on.

**Worked example.** Client A: one invoice, raised 06 Jan, received 09 Feb → 34 days,
nothing outstanding → **Steady**. Client D: 28 days → **Prompt**.

---

## 7. Invoice numbering

```
nextInvoiceNo(invoices, prefix):
  highest = max numeric suffix among invoices matching /^{prefix}(\d+)$/i,  else 0
  width   = max(5, digits in highest)
  return prefix + (highest + 1) zero-padded to width
```

Only invoices matching the configured prefix participate, so an unrelated numbering
scheme in the same sheet does not derail the series. Width never shrinks, so `SnS02534`
→ `SnS02535`, and a six-digit series stays six digits.

Duplicating an invoice takes the next number in the same series.

---

## 8. Rounding and money

- Monetary values are rounded to two decimals on write (`round2`).
- Derived figures are rounded only for **display**; sums are taken on unrounded values,
  so a column of amounts and its total always agree.
- Comparisons that decide whether an invoice is fully settled use a half-cent tolerance
  (`< 0.005`) rather than exact equality, because floating-point arithmetic on decimal
  currency will otherwise leave a settled invoice looking a hundredth short.
- Compact notation follows the base currency's convention: lakh and crore for INR
  (`₹9.46 L`, `₹1.20 Cr`), K and M elsewhere (`$10.8K`).
- All numeric columns render with tabular figures, right aligned, so magnitudes compare
  by eye down a column.

---

## 9. Activity reconstruction

The activity feed is not an event log — there is no event table, and one would drift
from the ledger. It is derived on every read:

| Event | Dated by | Colour |
|---|---|---|
| Payment received from *client* | `receivedOn` | Green |
| Invoice raised for *client* | `raisedOn` | Slate |
| Invoice went overdue | `dueDate` | Rose |

Merged, sorted newest first, capped at seven. A payment recorded with withholding says
so in its subtitle. The consequence worth knowing: the feed reflects the ledger's
current contents, so deleting an invoice removes its history too. That is the correct
trade for never having a log that disagrees with the data.

---

## 10. Report definitions

Each report is scoped by period (6/12/24 months), client, and the display currency, then
exported as CSV.

| Report | Rows | Columns |
|---|---|---|
| Revenue | One per month | Month, invoices, invoiced |
| Collections | One per month | Month, invoiced, collected, collection rate % |
| Outstanding receivables | One per unsettled invoice | Full invoice export |
| Aging | One per bucket | Bucket, invoices, amount, share % |
| Client performance | One per client with activity | Client, invoices, invoiced, collected, outstanding, avg days, on-time %, behaviour |
| Payment timeliness | One per settled invoice | Invoice, client, raised, due, received, days to collect, within terms |

CSV is UTF-8 with a byte-order mark so Excel opens it with the right encoding on a
double-click, `\r\n` line endings, and quotes any field containing a comma, quote or
newline.
