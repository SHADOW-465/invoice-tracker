# FinanceOS — Documentation

Reference documentation for FinanceOS, a local-only invoice and receivables ledger
backed directly by an Excel workbook.

**Version:** 2.0.0 · **Last reviewed:** 23 August 2026 · **Status:** in production use by
one operator, one workbook.

If you only want to run the thing, the root [`README.md`](../README.md) is the quick
start. These documents are the depth behind it.

---

## The document set

| Document | Answers |
|---|---|
| [PRD.md](PRD.md) | Who this is for, what problem it solves, what is deliberately out of scope, and how we know it worked. |
| [SRS.md](SRS.md) | Every functional and non-functional requirement, numbered and testable. |
| [architecture.md](architecture.md) | How the system is put together, why it is shaped that way, and the decisions that are hard to reverse. |
| [data-model.md](data-model.md) | The workbook schema: sheets, columns, types, legacy aliases, derived fields, invariants. |
| [financial-logic.md](financial-logic.md) | Every formula — conversion, aging, withholding, reconciliation, collection metrics — with worked examples. |
| [ui-spec.md](ui-spec.md) | Screen-by-screen specification, interaction rules, states, keyboard map. |
| [operations.md](operations.md) | Install, run, build, back up, restore, troubleshoot, and clone into a second business app. |
| [testing.md](testing.md) | What the automated checks cover, how to run them, and the manual QA script. |

Supporting documents outside this folder:

- [`../PRODUCT.md`](../PRODUCT.md) — brand personality and design principles.
- [`../DESIGN.md`](../DESIGN.md) — the visual system: palette, type, layout, motion.
- [`../AGENTS.md`](../AGENTS.md) — working rules for anyone (human or AI) changing the code.

---

## The one-paragraph summary

FinanceOS replaces a hand-kept invoice spreadsheet with a real interface, without
taking the spreadsheet away. The Excel workbook remains the database — not an import
source, not an export target, the actual system of record. A single mapping module
(`src/lib/workbook.js`) defines what the spreadsheet means; two thin shells drive it, a
Tauri desktop app that touches the file directly and a Node server for browser mode.
Nothing leaves the machine: no cloud, no account, no telemetry, and no network requests
at all — the fonts are bundled.

## The five things that constrain every decision

1. **The workbook is the truth.** Nothing is cached in the browser. Every action is a
   read-modify-write against the file, so an edit made by hand in Excel between two
   clicks is never silently overwritten.
2. **One writer, always snapshot-then-rename.** A crash mid-save cannot corrupt the
   ledger, and the previous thirty saves are recoverable.
3. **One implementation of the rules.** Desktop and browser builds share the mapping
   and validation module, so they cannot disagree about what a row means.
4. **Derive, do not store.** `Overdue`, aging, totals and every converted figure are
   computed at read time. Only facts live in the sheet.
5. **Local only, forever.** No sync, no multi-user, no server component beyond
   `127.0.0.1`. Features that require any of those are out of scope by design.
