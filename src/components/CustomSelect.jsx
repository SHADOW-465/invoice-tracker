import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export function CustomSelect({
  value,
  onChange,
  options, // Array of { value, label, badge, icon, sublabel } or strings
  placeholder = "Select...",
  icon: Icon,
  className = "",
  style = {},
  align = "left",
  size = "md", // "sm" | "md"
  searchable = false,
  searchPlaceholder = "Search..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Normalize options
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((o) => o.value === value);

  const visibleOptions = useMemo(() => {
    if (!searchable) return normalizedOptions;
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) => {
      const label = String(opt.label || "").toLowerCase();
      const sub = String(opt.sublabel || "").toLowerCase();
      const val = String(opt.value || "").toLowerCase();
      return label.includes(q) || sub.includes(q) || val.includes(q);
    });
  }, [normalizedOptions, query, searchable]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      if (searchable) {
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    } else {
      setQuery("");
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, searchable]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div
      ref={dropdownRef}
      className={`custom-select-wrapper ${className}`}
      style={{ position: "relative", display: "inline-block", ...style }}
    >
      <button
        type="button"
        className={`custom-select-trigger custom-select-trigger-${size} ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="custom-select-trigger-content">
          {Icon && <Icon size={size === "sm" ? 13 : 14} className="custom-select-icon" />}
          {selectedOption?.badge && (
            <span className={`currency-badge currency-badge-${String(selectedOption.badge || selectedOption.value).toLowerCase()}`}>
              {selectedOption.badge}
            </span>
          )}
          <span className="custom-select-label">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={size === "sm" ? 12 : 14}
          className={`custom-select-arrow ${isOpen ? "rotated" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`custom-select-menu custom-select-menu-${align}${searchable ? " is-searchable" : ""}`}
          role="listbox"
        >
          {searchable && (
            <div className="custom-select-search" onMouseDown={(e) => e.stopPropagation()}>
              <Search size={12} />
              <input
                ref={searchRef}
                type="search"
                className="custom-select-search-input"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && visibleOptions[0]) {
                    e.preventDefault();
                    handleSelect(visibleOptions[0].value);
                  }
                }}
              />
            </div>
          )}
          <div className="custom-select-menu-inner">
            {visibleOptions.length === 0 ? (
              <div className="custom-select-empty">No matches</div>
            ) : (
              visibleOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <div className="custom-select-option-content">
                    {opt.badge && (
                      <span className={`currency-badge currency-badge-${String(opt.badge || opt.value).toLowerCase()}`}>
                        {opt.badge}
                      </span>
                    )}
                    <span className="custom-select-option-label">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="custom-select-option-sublabel">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <Check size={13} className="custom-select-check" />}
                </button>
              );
            })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
