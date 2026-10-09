"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  calendarWeeks,
  formatDisplayDate,
  isoFromDate,
  monthStart,
  parseIsoDate,
  sameDay,
} from "@/lib/dates";

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateField({
  name,
  defaultValue,
  required = false,
}: {
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const initial = parseIsoDate(defaultValue) ?? new Date();
  const [viewMonth, setViewMonth] = useState(() => monthStart(initial.getFullYear(), initial.getMonth()));
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const today = new Date();

  function placeMenu() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 280) });
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    placeMenu();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);

  function pick(date: Date) {
    setValue(isoFromDate(date));
    setOpen(false);
  }

  function pickToday() {
    const now = new Date();
    setViewMonth(monthStart(now.getFullYear(), now.getMonth()));
    pick(now);
  }

  const weeks = calendarWeeks(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selected = parseIsoDate(value);

  return (
    <div className="select-field" ref={rootRef}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        className="input-field select-field-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const parsed = parseIsoDate(value);
          if (parsed) setViewMonth(monthStart(parsed.getFullYear(), parsed.getMonth()));
          placeMenu();
          setOpen(true);
        }}
      >
        <span className="truncate">{value ? formatDisplayDate(value) : "Select date"}</span>
        <CalendarIcon />
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="dialog"
              aria-label="Choose date"
              className="date-field-menu is-fixed"
              style={{ top: box.top, left: box.left, width: box.width }}
            >
              <div className="date-field-head">
                <button
                  type="button"
                  className="date-field-nav"
                  aria-label="Previous month"
                  onClick={() => setViewMonth((m) => addMonths(m, -1))}
                >
                  ‹
                </button>
                <p className="date-field-month">{monthLabel}</p>
                <button
                  type="button"
                  className="date-field-nav"
                  aria-label="Next month"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                >
                  ›
                </button>
              </div>
              <div className="date-field-weekdays">
                {weekdayLabels.map((label) => (
                  <span key={label} className="date-field-weekday">
                    {label}
                  </span>
                ))}
              </div>
              <div className="date-field-grid">
                {weeks.map((week) =>
                  week.map((day) => {
                    const inMonth = day.getMonth() === viewMonth.getMonth();
                    const isSelected = selected ? sameDay(day, selected) : false;
                    const isToday = sameDay(day, today);
                    return (
                      <button
                        key={isoFromDate(day)}
                        type="button"
                        className={[
                          "date-field-day",
                          !inMonth ? "is-outside" : "",
                          isSelected ? "is-selected" : "",
                          isToday && !isSelected ? "is-today" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => pick(day)}
                      >
                        {day.getDate()}
                      </button>
                    );
                  }),
                )}
              </div>
              <div className="date-field-foot">
                <button type="button" className="date-field-today" onClick={pickToday}>
                  Today
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-4 w-4 shrink-0 text-muted">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
