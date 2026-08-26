// Core Finance Data Structures & Preloaded Seed Data from Invoice Tracker.xlsx

export const INITIAL_INVOICES = [
  {
    id: "inv-1",
    invoiceNo: "SnS02530",
    clientName: "A",
    amount: 6816.60,
    currency: "USD",
    paymentMode: "Online",
    raisedOn: "2026-01-06",
    invoicedMonth: "January",
    status: "Received",
    receivedOn: "2026-02-09",
    paymentTerms: "Net 30",
    dueDate: "2026-02-05",
    taxRate: 0,
    taxAmount: 0,
    netReceived: 6816.60,
    remarks: ""
  },
  {
    id: "inv-2",
    invoiceNo: "SnS02531",
    clientName: "B",
    amount: 228.00,
    currency: "CHF",
    paymentMode: "Online",
    raisedOn: "2026-01-12",
    invoicedMonth: "January",
    status: "Received",
    receivedOn: "2026-02-11",
    paymentTerms: "Net 30",
    dueDate: "2026-02-11",
    taxRate: 0,
    taxAmount: 0,
    netReceived: 228.00,
    remarks: ""
  },
  {
    id: "inv-3",
    invoiceNo: "SnS02532",
    clientName: "V",
    amount: 3381.95,
    currency: "USD",
    paymentMode: "Online",
    raisedOn: "2026-01-12",
    invoicedMonth: "January",
    status: "Received",
    receivedOn: "2026-02-20",
    paymentTerms: "Net 30",
    dueDate: "2026-02-11",
    taxRate: 15,
    taxAmount: 507.29,
    netReceived: 2874.66,
    remarks: "Received payment after 15% tax deduction"
  },
  {
    id: "inv-4",
    invoiceNo: "SnS02533",
    clientName: "D",
    amount: 141.57,
    currency: "GBP",
    paymentMode: "Online",
    raisedOn: "2026-01-12",
    invoicedMonth: "January",
    status: "Received",
    receivedOn: "2026-02-09",
    paymentTerms: "Net 30",
    dueDate: "2026-02-11",
    taxRate: 0,
    taxAmount: 0,
    netReceived: 141.57,
    remarks: ""
  },
  {
    id: "inv-5",
    invoiceNo: "SnS02534",
    clientName: "E",
    amount: 125.80,
    currency: "GBP",
    paymentMode: "Online",
    raisedOn: "2026-01-12",
    invoicedMonth: "January",
    status: "Received",
    receivedOn: "2026-02-09",
    paymentTerms: "Net 30",
    dueDate: "2026-02-11",
    taxRate: 0,
    taxAmount: 0,
    netReceived: 125.80,
    remarks: ""
  }
];

export const INITIAL_CLIENTS = [
  { id: "c-1", name: "A", contactPerson: "", email: "billing@client-a.com", defaultCurrency: "USD", defaultTerms: "Net 30", notes: "Strategic technology partner" },
  { id: "c-2", name: "B", contactPerson: "", email: "accounts@client-b.ch", defaultCurrency: "CHF", defaultTerms: "Net 30", notes: "Swiss consulting client" },
  { id: "c-3", name: "V", contactPerson: "", email: "finance@client-v.com", defaultCurrency: "USD", defaultTerms: "Net 30", notes: "15% withholding tax applicable" },
  { id: "c-4", name: "D", contactPerson: "", email: "payments@client-d.co.uk", defaultCurrency: "GBP", defaultTerms: "Net 30", notes: "UK digital agency" },
  { id: "c-5", name: "E", contactPerson: "", email: "invoices@client-e.co.uk", defaultCurrency: "GBP", defaultTerms: "Net 30", notes: "E-commerce platform services" }
];

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar", rateToBase: 1.0 },
  { code: "EUR", symbol: "€", name: "Euro", rateToBase: 1.08 },
  { code: "GBP", symbol: "£", name: "British Pound", rateToBase: 1.28 },
  { code: "CHF", symbol: "CHF ", name: "Swiss Franc", rateToBase: 1.14 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", rateToBase: 0.012 },
  { code: "AED", symbol: "AED ", name: "UAE Dirham", rateToBase: 0.272 },
  { code: "SAR", symbol: "SAR ", name: "Saudi Riyal", rateToBase: 0.266 },
  { code: "ZAR", symbol: "R ", name: "South African Rand", rateToBase: 0.0545 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", rateToBase: 0.595 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", rateToBase: 0.0495 },
  { code: "PESO", symbol: "MX$", name: "Mexican Peso", rateToBase: 0.0495 },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", rateToBase: 0.74 },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar", rateToBase: 0.66 },
  { code: "SGD", symbol: "SG$", name: "Singapore Dollar", rateToBase: 0.75 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", rateToBase: 0.0067 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", rateToBase: 0.14 }
];

export const PAYMENT_MODES = [
  "Online",
  "Wire Transfer",
  "ACH / Direct Deposit",
  "Credit Card",
  "PayPal",
  "Stripe",
  "Bank Transfer",
  "Cheque"
];

export const PAYMENT_TERMS = [
  { label: "Due Immediately (Net 0)", days: 0 },
  { label: "Net 15 (15 Days)", days: 15 },
  { label: "Net 30 (30 Days)", days: 30 },
  { label: "Net 45 (45 Days)", days: 45 },
  { label: "Net 60 (60 Days)", days: 60 },
  { label: "Custom Due Date", days: null }
];

// Selectable collection statuses. "Partially Paid" records the actual amount
// received via netReceived and derives its remaining balance from that - it is
// set through the Record Payment dialog, not picked bare, because it needs an
// amount to mean anything.
export const STATUS_TYPES = [
  { value: "Received", label: "Received", color: "var(--status-received)" },
  { value: "Partially Paid", label: "Partially Paid", color: "var(--status-partial)" },
  { value: "Pending", label: "Pending", color: "var(--status-pending)" },
  { value: "Overdue", label: "Overdue", color: "var(--status-overdue)" },
  { value: "Suspended", label: "Suspended (on hold)", color: "var(--status-pending)" },
  { value: "Draft", label: "Draft", color: "var(--status-draft)" },
  { value: "Cancelled", label: "Cancelled", color: "var(--status-cancelled)" },
  { value: "Duplicate", label: "Duplicate", color: "var(--status-cancelled)" }
];
