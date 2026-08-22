# Design System & Bento Grid Specification

This document defines the visual design system, OKLCH color token architecture, typography hierarchy, Bento Grid layouts, and accessibility standards for **Invoice Tracker**.

---

## 1. Design Philosophy

Invoice Tracker adheres to modern product UI principles (Linear / Stripe / Mercury grade standards):

- **Tabular Density & Precision**: Monospace numerals (`JetBrains Mono`), right-aligned currency values, and explicit Net vs. Gross breakdowns.
- **Bento Grid Hierarchy**: Clean, modular overview tiles that group related metrics naturally, avoiding repetitive card grids or uncoordinated metric rows.
- **Restrained Semantic Palette**: Curated OKLCH colors with distinct meaning (Emerald for realized cash, Amber for pending, Rose for overdue receivables).
- **Zero AI Slop**: Strict avoidance of decorative gradient text, unmotivated glassmorphism, 3D borders, or oversized hero metrics.

---

## 2. Color System (OKLCH Architecture)

The application uses `oklch()` color tokens to ensure uniform perceptual brightness and contrast across dark and light themes.

### 2.1 Dark Theme (Default)
Engineered around deep obsidian slate surfaces with vibrant emerald and amber indicators:

```css
[data-theme="dark"] {
  /* Surfaces */
  --bg-app: oklch(0.13 0.012 260);              /* Deep obsidian slate */
  --bg-surface: oklch(0.165 0.014 260);          /* Primary container */
  --bg-surface-elevated: oklch(0.195 0.016 260); /* Elevated card/substat */
  --bg-surface-hover: oklch(0.225 0.018 260);    /* Hover highlight */
  --bg-surface-active: oklch(0.25 0.02 260);     /* Active selection */
  --bg-input: oklch(0.145 0.013 260);            /* Input container */

  /* Borders */
  --border-subtle: oklch(0.23 0.014 260);        /* Quiet divider */
  --border-strong: oklch(0.30 0.018 260);        /* Focused border */
  --border-focus: oklch(0.65 0.17 155);          /* Focus ring */

  /* Text & Inks */
  --ink-primary: oklch(0.96 0.005 260);          /* High-contrast text */
  --ink-secondary: oklch(0.76 0.012 260);        /* Body & subtext */
  --ink-muted: oklch(0.55 0.015 260);            /* Labels & captions */
  --ink-faint: oklch(0.38 0.015 260);            /* Placeholders */

  /* Brand Accent */
  --brand-primary: oklch(0.65 0.17 155);         /* Emerald */
  --brand-primary-hover: oklch(0.72 0.18 155);
  --brand-surface: oklch(0.20 0.04 155);
}
```

---

### 2.2 Light Theme
Engineered around crisp off-white backdrops with high-contrast slate text:

```css
[data-theme="light"] {
  /* Surfaces */
  --bg-app: oklch(0.975 0.003 250);              /* Crisp off-white */
  --bg-surface: oklch(1.0 0 0);                  /* Pure white card */
  --bg-surface-elevated: oklch(0.96 0.005 250);  /* Elevated container */
  --bg-surface-hover: oklch(0.935 0.008 250);
  --bg-surface-active: oklch(0.91 0.01 250);
  --bg-input: oklch(0.99 0.002 250);

  /* Borders */
  --border-subtle: oklch(0.89 0.008 250);
  --border-strong: oklch(0.79 0.014 250);
  --border-focus: oklch(0.48 0.16 155);

  /* Text & Inks */
  --ink-primary: oklch(0.16 0.015 260);          /* Deep charcoal */
  --ink-secondary: oklch(0.36 0.015 260);
  --ink-muted: oklch(0.52 0.012 260);
  --ink-faint: oklch(0.72 0.01 260);

  /* Brand Accent */
  --brand-primary: oklch(0.48 0.16 155);
  --brand-primary-hover: oklch(0.42 0.16 155);
  --brand-surface: oklch(0.94 0.04 155);
}
```

---

### 2.3 Semantic Status Palette

| Status | Role | Dark Mode Tokens (BG / Text / Border) | Light Mode Tokens (BG / Text / Border) |
| :--- | :--- | :--- | :--- |
| **Received** | Paid / Settled Cash | `oklch(0.21 0.05 145)` / `oklch(0.85 0.16 145)` / `oklch(0.34 0.09 145)` | `oklch(0.94 0.05 145)` / `oklch(0.32 0.14 145)` / `oklch(0.82 0.07 145)` |
| **Pending** | Within Payment Terms | `oklch(0.22 0.05 75)` / `oklch(0.87 0.14 75)` / `oklch(0.36 0.09 75)` | `oklch(0.95 0.05 75)` / `oklch(0.42 0.14 75)` / `oklch(0.84 0.08 75)` |
| **Overdue** | Past Due Term Date | `oklch(0.22 0.07 25)` / `oklch(0.88 0.16 25)` / `oklch(0.38 0.10 25)` | `oklch(0.95 0.06 25)` / `oklch(0.38 0.16 25)` / `oklch(0.84 0.09 25)` |
| **Partial** | Partial Settlement | `oklch(0.21 0.05 240)` / `oklch(0.86 0.13 240)` / `oklch(0.35 0.08 240)` | `oklch(0.94 0.05 240)` / `oklch(0.36 0.13 240)` / `oklch(0.82 0.07 240)` |

---

## 3. Typography Hierarchy

```css
:root {
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --text-xs: 0.75rem;    /* 12px - Labels, microcopy, badges */
  --text-sm: 0.8125rem;  /* 13px - Secondary body, table data */
  --text-base: 0.875rem; /* 14px - Primary body text */
  --text-md: 1rem;       /* 16px - Modal titles, prominent values */
  --text-lg: 1.125rem;   /* 18px - Section headers */
  --text-xl: 1.375rem;   /* 22px - Metric values */
  --text-2xl: 1.75rem;   /* 28px - Hero realized amount */
}
```

- **Monospace Usage**: Applied strictly to all numbers, currency symbols, invoice identifiers (`SnS02530`), ISO dates (`2026-01-12`), and calculation summaries via the `.mono-num` utility class (`font-variant-numeric: tabular-nums`).

---

## 4. Bento Grid Layout System

The Bento Grid organizes financial indicators into a cohesive 12-column modular dashboard:

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0.875rem;
}

.bento-card-hero     { grid-column: span 7; }
.bento-card-risk     { grid-column: span 5; }
.bento-card-chart    { grid-column: span 7; }
.bento-card-currency { grid-column: span 5; }

@media (max-width: 1080px) {
  .bento-card-hero,
  .bento-card-risk,
  .bento-card-chart,
  .bento-card-currency {
    grid-column: span 12;
  }
}
```

---

## 5. Accessibility & Inclusivity Standards

1. **Contrast Ratio Compliance**: All body text achieves $\ge 4.5:1$ contrast against surrounding surfaces; large and bold headings achieve $\ge 3:1$ under both Dark and Light modes.
2. **Keyboard Navigation & Dismissal**: All modals close on `Escape` keypress, interactive elements receive accessible focus rings (`--border-focus`), and tab order is preserved.
3. **Motion Sensitivity**: Transitions are non-disruptive and respect user preferences:
   ```css
   @media (prefers-reduced-motion: reduce) {
     * {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```
