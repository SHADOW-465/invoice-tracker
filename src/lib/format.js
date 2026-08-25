export const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export const SYMBOLS = { INR: "₹", USD: "$", GBP: "£", CHF: "CHF ", EUR: "€", AED: "AED ", SGD: "S$", AUD: "A$", CAD: "C$" };

export const symbolOf = (code) => SYMBOLS[code] || `${code} `;

// The user's calendar date, not UTC's. Between midnight and 05:30 in IST the UTC date
// is still yesterday, which would date receipts a day early and misreport overdue days.
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function addDays(iso, days) {
  if (!iso) return "";
  return new Date(new Date(iso + "T00:00:00Z").getTime() + days * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return 0;
  return Math.round((new Date(toISO + "T00:00:00Z") - new Date(fromISO + "T00:00:00Z")) / 86400000);
}

export const monthOf = (iso) => (iso ? MONTHS[Number(iso.slice(5, 7)) - 1] : "");

export function fmtDate(iso) {
  if (!iso) return "—";
  return `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(8, 10)}`;
}

export function fmtLong(iso) {
  if (!iso) return "—";
  return `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
}

export function group(n, dec = 2) {
  const neg = n < 0;
  const parts = Math.abs(n).toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + parts.join(parts[1] ? "." : "");
}

export const money = (n, currency, dec = 2) => symbolOf(currency) + group(n, dec);

/** Base-currency shorthand. Lakh/crore for INR, K/M elsewhere. */
export function compact(n, base = "INR") {
  const sym = symbolOf(base);
  const numVal = Number(n || 0);
  const a = Math.abs(numVal);
  if (base === "INR") {
    if (a >= 1e7) return `${sym}${(numVal / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${sym}${(numVal / 1e5).toFixed(2)} L`;
    return sym + group(numVal, 0);
  }
  if (a >= 1e6) return `${sym}${(numVal / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sym}${(numVal / 1e3).toFixed(1)}K`;
  return sym + group(numVal, 0);
}
