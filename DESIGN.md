# Design

FinanceOS reads like paper: warm off-white ground, quiet hairlines, ink-black type,
and colour reserved entirely for financial state. Light only — a ledger does not need
a dark mode, and a second theme is a second set of contrast bugs.

The canonical values live at the top of `src/styles.css`. This file explains them.

## Palette

| Token | Value | Used for |
|---|---|---|
| `--paper` | `#F6F6F4` | Page ground |
| `--panel` | `#FBFBFA` | Sidebar, drawers |
| `--card` | `#FFFFFF` | Cards and tables |
| `--ink` | `#14161A` | Primary type, primary buttons |
| `--ink-2` | `#26282D` | Values in key/value pairs |
| `--muted` | `#5F5F59` | Secondary type |
| `--faint` | `#9A9A94` | Labels, metadata |
| `--ghost` | `#B5B5AF` | Empty values, axis labels |
| `--line` | `rgba(17,19,24,.08)` | Hairlines |
| `--accent` | `#1A4D8F` | Invoiced series, links, focus |
| `--accent-soft` | `#9FBEDD` | Collected series |
| `--green` | `#2F6B4F` | Received |
| `--slate` | `#41505F` | Outstanding |
| `--red` | `#A8382F` | Overdue, shortfalls |
| `--amber` | `#C8862B` | Withholding, due soon |

Status colour appears in badges, aging bars and priority rails only. It is never
decorative, never a gradient, and never used to make a number feel exciting.

## Type

`Geist` for interface text, `Geist Mono` for anything numeric that must line up —
invoice numbers, currency amounts, rates. Body is 14px; tables run 12.5px because
density is the point. Every numeric column uses `font-variant-numeric: tabular-nums`
and is right-aligned so magnitudes compare at a glance.

Headings are 25px/600 with `-0.028em` tracking. KPI values are 23px/600. Nothing on
the page is larger than that — an oversized hero number is the house style of software
that has nothing to say.

## Layout

- Sidebar is a fixed 236px rail. Everything else is a single 1220px content column.
- Cards: white, 1px hairline, 12px radius, no shadow at rest. Shadow appears only on
  a hover lift for cards that are actually clickable.
- Radii: 6px small controls, 9px buttons and inputs, 12px cards.
- Drawers slide from the right at 460px. Modals are not used — a drawer keeps the
  ledger visible behind the work.

## Motion

`fadeUp` on page change, `slideIn` for drawers, `pop` for tooltips and toasts, all
140–200ms. Bars animate their height over 400ms on data change. Everything collapses
to near-zero under `prefers-reduced-motion`.

## Accessibility

Body text clears 4.5:1 on its ground; `--faint` is reserved for supporting text at or
above the large-text threshold. Focus is a 2px `--accent` ring with a 2px offset, never
removed. `Esc` closes every overlay, the command palette is fully arrow-navigable, and
toasts announce through `role="status"`.
