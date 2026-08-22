# AGENTS.md — Codebase Instructions & Agent Guidelines

This document serves as the primary technical directive for all AI coding assistants, automated agents, and pair programmers working in this repository.

---

## 1. Project Overview & Tech Stack

**Invoice Tracker** is a client-side financial receivables ledger and cash flow tracking application designed to replace spreadsheet friction (`Invoice Tracker.xlsx`) with automated calculations, Bento Grid executive dashboards, and bidirectional Excel interoperability.

### Technology Stack:
- **Runtime & UI**: React 18 (`react`, `react-dom`) + Vite 5
- **Styling**: Handcrafted **Vanilla CSS** with **OKLCH design tokens** and **Bento Grid** layout.
- **Icons**: Lucide Icons (`lucide-react`)
- **Excel Ingestion & Export**: SheetJS (`xlsx`)
- **Document Output**: jsPDF (`jspdf`)
- **Storage**: Client-side `localStorage` with versioned keys.

---

## 2. Directory Layout

```
finance_tracker/
├── docs/                        # Complete technical documentation suite
│   ├── README.md                # Master documentation index
│   ├── architecture.md          # System design & component topology
│   ├── financial-engine.md      # Calculation formulas & math specs
│   ├── data-schema.md           # TypeScript entity definitions & Excel mappings
│   ├── components.md            # React component catalog & props API
│   ├── design-system.md         # OKLCH tokens, Bento grid & accessibility
│   └── user-guide.md            # Operational workflows & user manual
├── src/
│   ├── components/              # Isolated React UI components
│   │   ├── Navbar.jsx           # Global header & quick actions
│   │   ├── DashboardMetrics.jsx # 12-column Bento Grid executive dashboard
│   │   ├── AnalyticsCharts.jsx  # Chart components & visualizers
│   │   ├── InvoiceTable.jsx     # High-density data grid & segmented tabs
│   │   ├── InvoiceModal.jsx     # Add/Edit invoice dialog
│   │   ├── MarkPaidModal.jsx    # Settlement & tax withholding dialog
│   │   ├── InvoicePreviewModal.jsx # Vector PDF & email reminder modal
│   │   ├── ClientsModal.jsx     # Client directory & billing totals
│   │   └── SettingsModal.jsx    # Business profile & banking details
│   ├── hooks/
│   │   └── useFinanceStore.js   # Centralized reactive state hook & storage
│   ├── types/
│   │   └── finance.js           # Enums, currency tables, seed records
│   ├── utils/
│   │   ├── calculations.js      # Pure financial math, aging, & currency engine
│   │   └── excelHandler.js      # SheetJS .xlsx parser and exporter
│   ├── App.jsx                  # Root orchestrator & modal coordinator
│   ├── index.css                # CSS variables, Bento grid, dark/light themes
│   └── main.jsx                 # Application entry point
├── AGENTS.md                    # Coding agent instructions (this file)
├── DESIGN.md                    # Design tokens & color system reference
├── PRODUCT.md                   # Product specification & brand personality
├── package.json                 # Project dependencies & npm scripts
└── vite.config.js               # Vite build configuration
```

---

## 3. Core Architectural Rules for Agents

### Rule 1: Maintain UI Design Standards (Linear / Stripe Grade)
- **Vanilla CSS Only**: Do NOT install TailwindCSS or heavy UI libraries unless the user explicitly requests it.
- **Color System**: Use `oklch()` CSS custom properties defined in `src/index.css`.
- **Absolute Bans (AI Slop)**:
  - NO decorative rainbow gradient text (`background-clip: text`).
  - NO generic glassmorphism or excessive background blurs.
  - NO side-stripe borders (`border-left: 4px solid ...`) on cards or table rows.
  - NO repetitive identical card grids — use the **Bento Grid** hierarchy.
  - NO screaming oversized header text (`clamp()` max $\le 28\text{px}$ for headers).
- **Monospace Numeral Stack**: Always apply `.mono-num` (`JetBrains Mono`, `font-variant-numeric: tabular-nums`) to all currency amounts, invoice numbers, dates, and calculation results.

---

### Rule 2: Keep Financial Math Pure & Deterministic
- All date math, aging computations, currency conversions, and tax calculations MUST reside in `src/utils/calculations.js`.
- Component files (`.jsx`) must NOT perform ad-hoc date arithmetic or un-rounded floating point math.
- Always use `toFixed(2)` and `round()` helpers when storing or calculating currency figures to prevent floating-point anomalies (e.g. `0.1 + 0.2 = 0.30000000000000004`).

---

### Rule 3: State Management & LocalStorage Conventions
- All global state is managed through `useFinanceStore` in `src/hooks/useFinanceStore.js`.
- Always persist state changes through the versioned keys:
  - `apex_finance_invoices_v1`
  - `apex_finance_clients_v1`
  - `apex_finance_settings_v1`
  - `apex_finance_base_currency_v1`
  - `apex_finance_theme_v1`
- When adding new fields to entities, ensure backward-compatible default fallback values are provided during JSON hydration.

---

### Rule 4: Preserve Excel Interoperability
- `exportToExcel()` in `src/utils/excelHandler.js` must output columns that match `Invoice Tracker.xlsx` exactly:
  1. `Invoice #`
  2. `Client Name`
  3. `Actual Invoiced Amt`
  4. `Mode of Payment`
  5. `UOM`
  6. `Raised on`
  7. `Invoiced Month`
  8. `Collection Status`
  9. `Received on`
  10. `Due by (days)`
  11. `Remarks`
- The parser `parseExcelFile()` must preserve fuzzy synonym matching for column headers and tax deduction notes (e.g. *"15% tax"*).

---

## 4. Development & Build Verification Workflow

When making modifications to this codebase, follow this verification checklist:

1. **Static Analysis & Build Check**:
   ```bash
   npm run build
   ```
   Ensure Vite compiles with **0 errors**.

2. **Calculation Integrity**:
   - Verify that marking an invoice with a 15% tax deduction yields exact Net Received and Tax Amount figures.
   - Verify that changing the Base Currency in the navbar recalculates Bento overview totals accurately without altering underlying invoice currencies.

3. **Responsive & Theme Verification**:
   - Verify layout stability in both `data-theme="dark"` and `data-theme="light"`.
   - Ensure the Bento Grid collapses gracefully from 12 columns to single column on viewports $< 1080\text{px}$.

---

## 5. Summary of Key Files

| File | Responsibility |
| :--- | :--- |
| `src/hooks/useFinanceStore.js` | Single source of truth for invoices, clients, settings, filters, and localStorage synchronization. |
| `src/utils/calculations.js` | Aging logic, DSO calculation, USD pivot currency normalization, financial aggregation. |
| `src/utils/excelHandler.js` | SheetJS bidirectional Excel `.xlsx` and `.csv` import/export pipeline. |
| `src/components/DashboardMetrics.jsx` | 12-column Bento Grid executive dashboard. |
| `src/components/InvoiceTable.jsx` | High-density data grid with segmented status tabs and sorting. |
| `src/index.css` | OKLCH color tokens, typography scales, Bento grid classes, dark/light theme definitions. |
