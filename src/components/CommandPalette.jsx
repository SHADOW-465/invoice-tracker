import React, { useEffect, useMemo, useRef, useState } from "react";
import { money } from "../lib/format";

const PAGES = [
  ["workspace", "Workspace"], ["collections", "Collections"], ["clients", "Clients"],
  ["payments", "Payments"], ["reports", "Reports"], ["settings", "Settings"]
];

export function CommandPalette({ ctx, onClose }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [
      ...PAGES.filter(([, label]) => !q || label.toLowerCase().includes(q)).map(([key, label]) => ({
        kind: "Page", label, hint: "", go: () => ctx.go(key)
      })),
      ...(q
        ? ctx.all
            .filter((i) => i.invoiceNo.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q))
            .slice(0, 6)
            .map((i) => ({
              kind: "Invoice",
              label: `${i.invoiceNo} · ${i.clientName}`,
              hint: money(i.amount, i.currency),
              go: () => ctx.go("invoice", { invoiceNo: i.invoiceNo })
            }))
        : []),
      ...(q
        ? ctx.clients
            .filter((c) => c.name.toLowerCase().includes(q) || c.fullName?.toLowerCase().includes(q))
            .slice(0, 4)
            .map((c) => ({
              kind: "Client", label: c.fullName || c.name, hint: "",
              go: () => ctx.go("client", { clientName: c.name })
            }))
        : []),
      ...("new invoice".includes(q) && q ? [{ kind: "Action", label: "New invoice", hint: "", go: ctx.newInvoice }] : [])
    ].slice(0, 9);
    return out;
  }, [query, ctx]);

  useEffect(() => { setCursor(0); }, [query]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); results[cursor]?.go(); }
  };

  return (
    <div className="palette-scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span style={{ color: "var(--faint)" }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search invoices, clients, or jump to a page"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="palette-list">
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.label}`}
              className={`palette-row ${i === cursor ? "cursor" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onClick={r.go}
            >
              <span className="palette-kind">{r.kind}</span>
              <span className="truncate">{r.label}</span>
              {r.hint && <span className="palette-hint">{r.hint}</span>}
            </button>
          ))}
          {!results.length && <div className="empty-sub" style={{ padding: 18 }}>Nothing matches “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}
