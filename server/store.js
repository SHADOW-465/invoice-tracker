// Filesystem shell around the shared workbook mapping. The rules of the spreadsheet
// live in src/lib/workbook.js; this file only knows about disk.
// ponytail: whole-file rewrite per save — fine to ~50k rows. Swap for SQLite if you
// ever need concurrent writers or row history.
import fs from "node:fs";
import path from "node:path";
import { parseWorkbook, buildWorkbook } from "../src/lib/workbook.js";

const ROOT = path.resolve(import.meta.dirname, "..");
export const BOOK = process.env.LEDGER_FILE || path.join(ROOT, "Invoice Tracker.xlsx");
// Snapshots live beside the workbook, so moving the ledger moves its history with it.
const BACKUPS = path.join(path.dirname(BOOK), "backups");

const bytes = () => (fs.existsSync(BOOK) ? new Uint8Array(fs.readFileSync(BOOK)) : null);

export function readAll() {
  return { ...parseWorkbook(bytes()), file: BOOK };
}

export function writeAll(data) {
  const out = buildWorkbook(data, bytes());
  backup();
  // Atomic: a crash mid-write leaves the previous workbook intact, not a truncated one.
  const tmp = BOOK.replace(/\.xlsx$/i, "") + ".saving.xlsx";
  fs.writeFileSync(tmp, out);
  fs.renameSync(tmp, BOOK);
}

function backup() {
  if (!fs.existsSync(BOOK)) return;
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(BOOK, path.join(BACKUPS, `Invoice Tracker ${stamp}.xlsx`));
  // Keep the last 30 snapshots; older ones are noise.
  const stale = fs.readdirSync(BACKUPS).filter((f) => f.endsWith(".xlsx")).sort().slice(0, -30);
  for (const f of stale) fs.unlinkSync(path.join(BACKUPS, f));
}

export { monthOf, addDays, today, daysBetween } from "../src/lib/workbook.js";
