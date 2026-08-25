import { DEFAULT_SETTINGS, addDays, mutations } from "./workbook.js";
import { today } from "./format.js";

function isoShift(days) {
  return addDays(today(), days);
}

function seed() {
  const invoices = [
    {
      invoiceNo: "SnS-2401",
      clientName: "Northwind Labs",
      amount: 185000,
      currency: "INR",
      paymentMode: "Online",
      raisedOn: isoShift(-95),
      invoicedMonth: "",
      status: "Received",
      receivedOn: isoShift(-62),
      dueDate: isoShift(-65),
      termDays: 30,
      taxRate: 10,
      taxAmount: 18500,
      amountReceived: 166500,
      remarks: "Q1 retainers — settled"
    },
    {
      invoiceNo: "SnS-2408",
      clientName: "Helvetia Watch Co",
      amount: 4200,
      currency: "CHF",
      paymentMode: "Wire",
      raisedOn: isoShift(-48),
      invoicedMonth: "",
      status: "Outstanding",
      receivedOn: "",
      dueDate: isoShift(-18),
      termDays: 30,
      taxRate: 0,
      taxAmount: 0,
      amountReceived: 0,
      remarks: "Design sprint, 3 weeks"
    },
    {
      invoiceNo: "SnS-2411",
      clientName: "Meridian Capital",
      amount: 12500,
      currency: "USD",
      paymentMode: "Online",
      raisedOn: isoShift(-22),
      invoicedMonth: "",
      status: "Outstanding",
      receivedOn: "",
      dueDate: isoShift(8),
      termDays: 30,
      taxRate: 15,
      taxAmount: 1875,
      amountReceived: 0,
      remarks: "Monthly advisory"
    },
    {
      invoiceNo: "SnS-2412",
      clientName: "Oak & River LLP",
      amount: 98000,
      currency: "INR",
      paymentMode: "Cheque",
      raisedOn: isoShift(-12),
      invoicedMonth: "",
      status: "Outstanding",
      receivedOn: "",
      dueDate: isoShift(18),
      termDays: 30,
      taxRate: 10,
      taxAmount: 9800,
      amountReceived: 0,
      remarks: ""
    },
    {
      invoiceNo: "SnS-2414",
      clientName: "Northwind Labs",
      amount: 240000,
      currency: "INR",
      paymentMode: "Online",
      raisedOn: isoShift(-6),
      invoicedMonth: "",
      status: "Received",
      receivedOn: isoShift(-1),
      dueDate: isoShift(24),
      termDays: 30,
      taxRate: 10,
      taxAmount: 24000,
      amountReceived: 216000,
      remarks: "Paid early"
    },
    {
      invoiceNo: "SnS-2388",
      clientName: "Greyline Media",
      amount: 3100,
      currency: "GBP",
      paymentMode: "Wire",
      raisedOn: isoShift(-140),
      invoicedMonth: "",
      status: "Outstanding",
      receivedOn: "",
      dueDate: isoShift(-110),
      termDays: 30,
      taxRate: 0,
      taxAmount: 0,
      amountReceived: 0,
      remarks: "Follow up weekly"
    }
  ];

  const clients = [
    { name: "Northwind Labs", fullName: "Northwind Laboratories Pvt Ltd", email: "ap@northwind.example", currency: "INR", termDays: 30, taxRate: 10, notes: "Preferred client" },
    { name: "Helvetia Watch Co", fullName: "Helvetia Watch Company AG", email: "finance@helvetia.example", currency: "CHF", termDays: 30, taxRate: 0, notes: "" },
    { name: "Meridian Capital", fullName: "Meridian Capital LLC", email: "ops@meridian.example", currency: "USD", termDays: 30, taxRate: 15, notes: "Net 30" },
    { name: "Oak & River LLP", fullName: "Oak & River LLP", email: "accounts@oakriver.example", currency: "INR", termDays: 30, taxRate: 10, notes: "" },
    { name: "Greyline Media", fullName: "Greyline Media Ltd", email: "payables@greyline.example", currency: "GBP", termDays: 30, taxRate: 0, notes: "Slow payer" }
  ];

  return {
    invoices,
    clients,
    settings: { ...DEFAULT_SETTINGS },
    file: "Preview sample (not saved)"
  };
}

let store = seed();
export let demoActive = false;

export function enableDemo() {
  demoActive = true;
  store = seed();
}

function snapshot() {
  return {
    invoices: store.invoices.map((i) => ({ ...i })),
    clients: store.clients.map((c) => ({ ...c })),
    settings: { ...store.settings, rates: { ...store.settings.rates } },
    file: store.file
  };
}

function apply(name, body, arg) {
  mutations[name](store, body, arg);
  return snapshot();
}

export const demoApi = {
  load: async () => snapshot(),
  createInvoice: async (inv) => apply("createInvoice", inv),
  updateInvoice: async (no, inv) => apply("updateInvoice", inv, no),
  deleteInvoice: async (no) => apply("deleteInvoice", {}, no),
  saveClient: async (client) => apply("saveClient", client),
  saveSettings: async (settings) => apply("saveSettings", settings)
};
