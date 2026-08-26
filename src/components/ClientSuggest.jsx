import React, { useEffect, useMemo, useRef, useState } from "react";
import { getClientColor } from "../utils/calculations";

function rankMatches(query, items) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items.slice(0, 8);

  const scored = [];
  for (const item of items) {
    const n = String(item.name || "").toLowerCase();
    if (!n) continue;
    let score = 0;
    if (n === q) score = 100;
    else if (n.startsWith(q)) score = 80;
    else if (n.split(/\s+/).some((w) => w.startsWith(q))) score = 60;
    else if (n.includes(q)) score = 40;
    else continue;
    scored.push({ ...item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, 8);
}

function highlight(name, query) {
  const q = String(query || "").trim();
  if (!q) return name;
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return name;
  return (
    <>
      {name.slice(0, i)}
      <mark className="client-suggest-mark">{name.slice(i, i + q.length)}</mark>
      {name.slice(i + q.length)}
    </>
  );
}

export function ClientSuggest({
  value,
  onChange,
  onPick,
  clients = [],
  invoiceNames = [],
  placeholder = "Start typing a client name"
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const directory = useMemo(() => {
    const byKey = new Map();
    (clients || []).forEach((c) => {
      const name = String(c?.name || "").trim();
      if (!name) return;
      byKey.set(name.toLowerCase(), { name, client: c });
    });
    (invoiceNames || []).forEach((raw) => {
      const name = String(raw || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { name, client: null });
    });
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, invoiceNames]);

  const matches = useMemo(() => rankMatches(value, directory), [value, directory]);

  useEffect(() => {
    setActiveIndex(0);
  }, [value, open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const pick = (item) => {
    onChange(item.name);
    if (typeof onPick === "function") onPick(item.name, item.client);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (matches[activeIndex]) {
        e.preventDefault();
        pick(matches[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const showMenu = open && matches.length > 0;

  return (
    <div className="client-suggest" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        required
        aria-autocomplete="list"
        aria-expanded={showMenu}
      />
      {showMenu && (
        <ul className="client-suggest-menu" role="listbox">
          {matches.map((item, idx) => {
            const colors = getClientColor(item.name) || {
              bg: "var(--bg-surface-elevated)",
              text: "var(--ink-primary)",
              border: "var(--border-subtle)"
            };
            return (
              <li key={item.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`client-suggest-option ${idx === activeIndex ? "active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(item);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <span
                    className="client-suggest-avatar"
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      borderColor: colors.border
                    }}
                  >
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="client-suggest-name">{highlight(item.name, value)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
