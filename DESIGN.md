# Design System: Invoice Tracker

## Color Palette (OKLCH)

### Dark Theme (Default)
- **Background App**: `oklch(0.13 0.012 260)` (deep obsidian slate)
- **Background Surface**: `oklch(0.17 0.015 260)` (subtle elevated container)
- **Background Surface Hover**: `oklch(0.22 0.018 260)`
- **Background Input**: `oklch(0.15 0.014 260)`
- **Border Subtle**: `oklch(0.25 0.015 260)`
- **Border Strong**: `oklch(0.32 0.020 260)`
- **Text Primary**: `oklch(0.96 0.005 260)`
- **Text Secondary**: `oklch(0.75 0.012 260)`
- **Text Muted**: `oklch(0.55 0.015 260)`

### Light Theme
- **Background App**: `oklch(0.98 0.004 250)` (crisp off-white)
- **Background Surface**: `oklch(1.0 0 0)` (pure white)
- **Background Surface Hover**: `oklch(0.95 0.008 250)`
- **Border Subtle**: `oklch(0.88 0.008 250)`
- **Border Strong**: `oklch(0.78 0.015 250)`
- **Text Primary**: `oklch(0.15 0.015 260)`
- **Text Secondary**: `oklch(0.38 0.015 260)`
- **Text Muted**: `oklch(0.55 0.012 260)`

### Semantic Status Tokens
- **Received (Paid)**:
  - Dark: bg `oklch(0.22 0.06 145)`, text `oklch(0.86 0.16 145)`, border `oklch(0.35 0.09 145)`
  - Light: bg `oklch(0.94 0.06 145)`, text `oklch(0.32 0.14 145)`, border `oklch(0.82 0.08 145)`
- **Pending**:
  - Dark: bg `oklch(0.23 0.06 75)`, text `oklch(0.88 0.14 75)`, border `oklch(0.38 0.09 75)`
  - Light: bg `oklch(0.95 0.06 75)`, text `oklch(0.42 0.14 75)`, border `oklch(0.84 0.09 75)`
- **Overdue**:
  - Dark: bg `oklch(0.22 0.07 25)`, text `oklch(0.88 0.16 25)`, border `oklch(0.38 0.10 25)`
  - Light: bg `oklch(0.95 0.06 25)`, text `oklch(0.38 0.16 25)`, border `oklch(0.84 0.10 25)`

## Typography

- **UI Sans**: `Plus Jakarta Sans`, system-ui, -apple-system, sans-serif
- **Monospace Numeral Stack**: `JetBrains Mono`, monospace (for currency, invoice numbers, dates, calculations)
- **Hierarchy Scale**:
  - Title / Header: `1.125rem` (18px), font-weight 700
  - Section Headings: `0.9375rem` (15px), font-weight 600
  - Table Headers: `0.75rem` (12px), uppercase, letter-spacing `0.04em`
  - Body Text: `0.875rem` (14px)
  - Microcopy / Badges: `0.75rem` (12px)

## Layout, Density & Bento Grid Architecture

- **Max Container Width**: `1480px`
- **Bento Grid System**: 12-column responsive layout:
  - **Hero Realized Cash Flow Card**: `span 7` columns (`bento-card-hero`)
  - **Receivables & Aging Health Card**: `span 5` columns (`bento-card-risk`)
  - **Monthly Cash Flow Momentum Chart**: `span 7` columns (`bento-card-chart`)
  - **Portfolio Multi-Currency Allocation**: `span 5` columns (`bento-card-currency`)
  - **Responsive Collapse**: Collapses to single-column (`span 12`) on viewports $< 1080\text{px}$.
- **Table Density**:
  - Compact header height: `32px` (uppercase, letter-spacing `0.04em`)
  - Data row height: `44px` compact standard
  - Right-aligned monospace monetary values (`.mono-num`)
- **Interactive Controls**: `32px` - `36px` height with `6px` border-radius
- **Modals**: Centered, max-width `580px` (standard) or `780px` (large), backdrop blur `4px`, keyboard dismissible (`Esc`)
