import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export function CustomSelect({
  value,
  onChange,
  options, // Array of { value, label, badge, icon, sublabel } or strings
  placeholder = "Select...",
  icon: Icon,
  className = "",
  style = {},
  align = "left",
  size = "md" // "sm" | "md"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Normalize options
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((o) => o.value === value);

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
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

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
            <span className={`currency-badge currency-badge-${selectedOption.value.toLowerCase()}`}>
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
          className={`custom-select-menu custom-select-menu-${align}`}
          role="listbox"
        >
          <div className="custom-select-menu-inner">
            {normalizedOptions.map((opt) => {
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
                      <span className={`currency-badge currency-badge-${opt.value.toLowerCase()}`}>
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
            })}
          </div>
        </div>
      )}
    </div>
  );
}
