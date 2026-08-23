import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { MONTH_NAMES } from "../utils/calculations";

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  required = false,
  allowClear = false,
  minDate,
  maxDate
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Parse current selected date
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(value);
  }, [value]);

  // View state (the month/year currently visible in calendar)
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate && !isNaN(selectedDate.getTime())) {
      return selectedDate.getFullYear();
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate && !isNaN(selectedDate.getTime())) {
      return selectedDate.getMonth();
    }
    return new Date().getMonth();
  });

  // Sync view when opened with a value
  useEffect(() => {
    if (isOpen && selectedDate && !isNaN(selectedDate.getTime())) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [isOpen, selectedDate]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
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

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (year, month, day, e) => {
    e.stopPropagation();
    const formattedMonth = String(month + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const today = new Date();
    const formattedMonth = String(today.getMonth() + 1).padStart(2, "0");
    const formattedDay = String(today.getDate()).padStart(2, "0");
    const dateStr = `${today.getFullYear()}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Calendar Grid Days Calculation
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        month: viewMonth === 0 ? 11 : viewMonth - 1,
        year: viewMonth === 0 ? viewYear - 1 : viewYear,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        day: i,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true
      });
    }

    // Next month padding to fill complete grid of 35 or 42
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        month: viewMonth === 11 ? 0 : viewMonth + 1,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
        isCurrentMonth: false
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Today check
  const today = new Date();
  const isToday = (year, month, day) => {
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  // Selected check
  const isDateSelected = (year, month, day) => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return false;
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  // Display text formatted: e.g. "Jan 12, 2026"
  const formattedDisplay = useMemo(() => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return "";
    const m = MONTH_NAMES[selectedDate.getMonth()]?.slice(0, 3) || "";
    const d = selectedDate.getDate();
    const y = selectedDate.getFullYear();
    return `${m} ${d}, ${y}`;
  }, [selectedDate]);

  return (
    <div
      ref={dropdownRef}
      className="custom-datepicker-container"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Trigger Button Field */}
      <button
        type="button"
        className={`custom-datepicker-trigger ${isOpen ? "focused" : ""} ${!value ? "placeholder" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="custom-datepicker-trigger-left">
          <CalendarIcon size={14} className="custom-datepicker-icon" />
          <span className="mono-num">
            {formattedDisplay || placeholder}
          </span>
        </div>

        <div className="custom-datepicker-trigger-right">
          {allowClear && value && (
            <span
              className="custom-datepicker-clear-btn"
              onClick={handleClear}
              title="Clear date"
            >
              <X size={12} />
            </span>
          )}
        </div>
      </button>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <div className="custom-datepicker-popover" role="dialog" aria-modal="true">
          {/* Header Navigation */}
          <div className="custom-datepicker-header">
            <button
              type="button"
              className="custom-datepicker-nav-btn"
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="custom-datepicker-title">
              <span className="custom-datepicker-month-name">
                {MONTH_NAMES[viewMonth]}
              </span>
              <span className="custom-datepicker-year mono-num">
                {viewYear}
              </span>
            </div>

            <button
              type="button"
              className="custom-datepicker-nav-btn"
              onClick={handleNextMonth}
              title="Next Month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="custom-datepicker-weekdays">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days Grid */}
          <div className="custom-datepicker-days-grid">
            {calendarGrid.map((item, idx) => {
              const selected = isDateSelected(item.year, item.month, item.day);
              const todayCell = isToday(item.year, item.month, item.day);

              return (
                <button
                  key={`${item.year}-${item.month}-${item.day}-${idx}`}
                  type="button"
                  className={`custom-datepicker-day-btn ${
                    !item.isCurrentMonth ? "outside-month" : ""
                  } ${selected ? "selected" : ""} ${todayCell ? "today" : ""}`}
                  onClick={(e) => handleSelectDay(item.year, item.month, item.day, e)}
                >
                  <span className="mono-num">{item.day}</span>
                </button>
              );
            })}
          </div>

          {/* Footer with Today and Clear Quick Actions */}
          <div className="custom-datepicker-footer">
            <button
              type="button"
              className="custom-datepicker-action-btn"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="custom-datepicker-action-btn custom-datepicker-action-today"
              onClick={handleSelectToday}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
