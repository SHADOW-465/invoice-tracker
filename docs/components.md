# Component Catalog & API Reference

This document provides a comprehensive technical reference for all React components in the **Invoice Tracker** frontend architecture.

---

## 1. Component Hierarchy Overview

```
src/
├── App.jsx                     # Root application container & modal coordinator
├── components/
│   ├── Navbar.jsx              # Global header, currency picker, import/export & theme
│   ├── DashboardMetrics.jsx    # Executive 12-column Bento Grid dashboard
│   ├── AnalyticsCharts.jsx     # Visual chart modules & cash flow distribution
│   ├── InvoiceTable.jsx        # High-density precision ledger, tabs, search & actions
│   ├── InvoiceModal.jsx        # Create/Edit invoice dialog with terms calculator
│   ├── MarkPaidModal.jsx       # Settlement dialog with real-time tax deduction
│   ├── InvoicePreviewModal.jsx # Branded vector PDF preview & payment reminder generator
│   ├── ClientsModal.jsx        # Client directory, accounts & billing stats
│   └── SettingsModal.jsx       # Business preferences, entity branding & wire details
```

---

## 2. Component Specifications

### 2.1 `App.jsx`
- **Purpose**: Root application shell orchestrating global view state, modal dialog visibility, toast notification queue, and layout structure.
- **Props**: None (Root component).
- **Internal State**:
  - `showAnalytics` (`boolean`): Controls expansion of visual momentum charts within the Bento Grid.
  - `isInvoiceModalOpen` / `editingInvoice`: State for the Create/Edit Invoice dialog.
  - `isMarkPaidOpen` / `markingInvoice`: State for the Mark Paid dialog.
  - `isPreviewOpen` / `previewInvoice`: State for the PDF & Reminder Preview dialog.
  - `isClientsOpen`: State for the Client Directory modal.
  - `isSettingsOpen`: State for the Business Settings modal.
  - `toasts` (`Array<{ id, message, type }>`): Ephemeral notification stack.

---

### 2.2 `Navbar.jsx`
- **Purpose**: Top navigation header providing instant access to global actions, base currency switching, Excel import/export triggers, theme toggle, and the primary "New Invoice" CTA.
- **Props**:
  ```typescript
  interface NavbarProps {
    store: ReturnType<typeof useFinanceStore>;
    onOpenNewInvoice: () => void;
    onOpenClients: () => void;
    onOpenSettings: () => void;
    onShowToast: (message: string, type?: "success" | "error") => void;
  }
  ```
- **Key Interactions**:
  - **Base Currency Selector**: Updates `store.baseCurrency`, instantaneously re-normalizing all dashboard totals.
  - **Import**: Triggers hidden `<input type="file">` to invoke `parseExcelFile()`.
  - **Export**: Invokes `exportToExcel()` to generate `.xlsx` file.
  - **Theme Toggle**: Cycles between `"dark"` (Obsidian slate) and `"light"` (Crisp off-white).

---

### 2.3 `DashboardMetrics.jsx` (Bento Grid Overview)
- **Purpose**: High-density executive Bento Grid displaying real-time financial health, realization ratios, overdue risks, and monthly cash flow momentum.
- **Props**:
  ```typescript
  interface DashboardMetricsProps {
    store: ReturnType<typeof useFinanceStore>;
    showAnalytics: boolean;
    onToggleAnalytics: () => void;
  }
  ```
- **Bento Modules**:
  1. **Hero Realized Cash Card (`span 7`)**: Total Collected Net, Realization Percentage Pill, Dual-Color Collection Progress Bar, Substats (Tax Withheld, Settled Count, Avg DSO).
  2. **Receivables & Aging Health Card (`span 5`)**: Active Pending balance, Overdue amount, Health status badge ("Healthy Ledger" vs "Action Required"), Micro Aging Strip (0–30d, 31–60d, 61–90d+).
  3. **Cash Flow Momentum (`span 7` - Expanded)**: Comparative dual-bar chart showing monthly Invoiced vs Collected amounts.
  4. **Multi-Currency Allocation (`span 5` - Expanded)**: Native currency ledger breakdown with counts and totals.

---

### 2.4 `InvoiceTable.jsx`
- **Purpose**: Core interactive financial data table engineered for speed, high visual density, and rapid invoice management.
- **Props**:
  ```typescript
  interface InvoiceTableProps {
    store: ReturnType<typeof useFinanceStore>;
    onOpenEditInvoice: (invoice: Invoice) => void;
    onOpenMarkPaid: (invoice: Invoice) => void;
    onOpenPreviewInvoice: (invoice: Invoice) => void;
    onShowToast: (message: string, type?: "success" | "error") => void;
  }
  ```
- **Features**:
  - **Segmented Status Tabs**: Instant 1-click filtering between `All`, `Received`, `Pending`, and `Overdue` with real-time count badges.
  - **Full-Text Live Search**: Filters across invoice numbers, client names, remarks, and monetary values.
  - **Multi-Select Batch Actions**: Checkboxes with bulk deletion capabilities.
  - **Sortable Columns**: Interactive sorting on Invoice #, Client, Amount, Raised Date, Status, Settled Date.
  - **Net vs Gross Visual Breakdown**: Highlights tax deductions (e.g. 15% TDS) directly beneath gross values.
  - **Row Quick Actions**: Mark Paid, View/PDF, Edit, Duplicate, and Delete.

---

### 2.5 `InvoiceModal.jsx`
- **Purpose**: Modal form for creating new invoices or editing existing records.
- **Props**:
  ```typescript
  interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: Invoice | null;
    onSave: (formData: Partial<Invoice>) => void;
    getNextInvoiceNumber: () => string;
    clients: Client[];
  }
  ```
- **Features**:
  - Auto-generation of sequential invoice numbers (e.g. `SnS02535`).
  - Client autocomplete datalist.
  - Dynamic payment terms calculator (Net 0, 15, 30, 45, 60) that automatically updates the due date.
  - Automatic invoiced month derivation from raised date.

---

### 2.6 `MarkPaidModal.jsx`
- **Purpose**: Rapid settlement reconciliation dialog allowing users to record the settlement date, apply tax withholding rates (e.g. 15%), review net credited cash, and celebrate with a confetti burst.
- **Props**:
  ```typescript
  interface MarkPaidModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    onConfirm: (id: string, settlementData: { receivedOn: string; taxRate: number; taxAmount: number; netReceived: number; remarks: string }) => void;
  }
  ```
- **Features**:
  - Real-time calculation box showing Gross Invoiced, Tax Withheld, and Net Credited.
  - Auto-populates remarks with deduction notes (e.g. *"Received payment after 15% tax deduction"*).
  - Canvas confetti particle animation on confirmation.

---

### 2.7 `InvoicePreviewModal.jsx`
- **Purpose**: Document preview window with dual tabs:
  1. **Invoice Document**: Vector A4 sheet preview with 1-click `jsPDF` vector download and native browser printing.
  2. **Payment Reminder**: Dynamically compiled email template with overdue days counter, invoice metadata, and bank remittance instructions.
- **Props**:
  ```typescript
  interface InvoicePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice | null;
    settings: BusinessSettings;
    onShowToast: (message: string, type?: "success" | "error") => void;
  }
  ```

---

### 2.8 `ClientsModal.jsx`
- **Purpose**: Client directory management modal displaying client profiles, billing totals in base currency, open balances, invoice counts, and registration form.
- **Props**:
  ```typescript
  interface ClientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    store: ReturnType<typeof useFinanceStore>;
    onShowToast: (message: string, type?: "success" | "error") => void;
  }
  ```

---

### 2.9 `SettingsModal.jsx`
- **Purpose**: Business profile configuration modal for managing company details, accounts email, invoice numbering prefix, default payment terms, and bank remittance instructions.
- **Props**:
  ```typescript
  interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: BusinessSettings;
    onSaveSettings: (settings: BusinessSettings) => void;
    onShowToast: (message: string, type?: "success" | "error") => void;
  }
  ```
