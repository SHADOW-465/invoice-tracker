// Desktop (Tauri) data layer. No server, no localhost: the webview reads and writes
// the workbook directly through the fs plugin, using the same mapping module the Node
// server uses. Identical rules, identical results, one implementation.
import { readFile, writeFile, exists, mkdir, readDir, remove, rename } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { parseWorkbook, buildWorkbook, mutations } from "./workbook.js";

export const isDesktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const PATH_KEY = "financeos.ledgerPath";
const sep = (p) => (p.includes("\\") ? "\\" : "/");
const dirOf = (p) => p.slice(0, p.lastIndexOf(sep(p))) || ".";
const nameOf = (p) => p.slice(p.lastIndexOf(sep(p)) + 1);

export const savedPath = () => localStorage.getItem(PATH_KEY) || "";

/** Ask for the workbook. Returns the chosen path, or "" if the user cancelled. */
export async function pickLedger() {
  const picked = await open({
    multiple: false,
    directory: false,
    title: "Choose your invoice workbook",
    filters: [{ name: "Excel workbook", extensions: ["xlsx", "xlsm"] }]
  });
  const path = Array.isArray(picked) ? picked[0] : picked;
  if (!path) return "";
  localStorage.setItem(PATH_KEY, path);
  return path;
}

async function readData(path) {
  if (!(await exists(path))) {
    throw new Error(`The workbook is no longer at ${path}. Choose it again.`);
  }
  return { ...parseWorkbook(await readFile(path)), file: path };
}

async function writeData(path, data) {
  const out = buildWorkbook(data, await readFile(path).catch(() => null));
  await snapshot(path);
  // Atomic: a crash mid-write leaves the previous workbook intact, not a truncated one.
  const tmp = path.replace(/\.xlsx?$/i, "") + ".saving.xlsx";
  await writeFile(tmp, out);
  if (await exists(path)) await remove(path);
  await rename(tmp, path);
}

async function snapshot(path) {
  if (!(await exists(path))) return;
  const dir = `${dirOf(path)}${sep(path)}backups`;
  await mkdir(dir, { recursive: true }).catch(() => {});
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await writeFile(`${dir}${sep(path)}${nameOf(path).replace(/\.xlsx?$/i, "")} ${stamp}.xlsx`, await readFile(path));
  // Keep the last 30 snapshots; older ones are noise.
  const stale = (await readDir(dir))
    .filter((e) => e.name.endsWith(".xlsx"))
    .map((e) => e.name)
    .sort()
    .slice(0, -30);
  for (const f of stale) await remove(`${dir}${sep(path)}${f}`).catch(() => {});
}

// Read-modify-write per action, so an edit made in Excel between two clicks is never
// overwritten by stale state held in the interface.
async function mutate(name, body, arg) {
  const path = savedPath();
  const data = await readData(path);
  try {
    mutations[name](data, body, arg);
  } catch (err) {
    throw new Error(err.errors ? err.errors.join(" · ") : err.message);
  }
  try {
    await writeData(path, data);
  } catch (err) {
    // Excel takes an exclusive lock on an open workbook.
    throw new Error(
      /denied|busy|locked|used by another/i.test(String(err))
        ? `The workbook is open in Excel. Close "${nameOf(path)}" and try again.`
        : String(err.message || err)
    );
  }
  return readData(path);
}

export const desktopApi = {
  load: async () => {
    const path = savedPath();
    if (!path) throw Object.assign(new Error("No workbook chosen yet"), { needsLedger: true });
    return readData(path);
  },
  createInvoice: (inv) => mutate("createInvoice", inv),
  updateInvoice: (no, inv) => mutate("updateInvoice", inv, no),
  deleteInvoice: (no) => mutate("deleteInvoice", {}, no),
  saveClient: (client) => mutate("saveClient", client),
  saveSettings: (settings) => mutate("saveSettings", settings)
};
