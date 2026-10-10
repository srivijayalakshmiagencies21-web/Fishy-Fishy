"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readCustomParties } from "@/lib/finance-party-memory";

type PartySuggestionGroup = {
  id: string;
  label: string;
  names: string[];
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function filterNames(names: string[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return names;
  return names.filter((name) => name.toLowerCase().includes(q));
}

function uniqueSorted(names: string[]) {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function PartyField({
  name,
  value,
  onChange,
  required = false,
  placeholder = "Enter party name",
  vendors,
  districts,
  societies,
  "aria-label": ariaLabel,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  vendors: string[];
  districts: string[];
  societies: string[];
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  /** Filters the suggestion menu only; empty string shows full Vendor / District / Society lists. */
  const [menuFilter, setMenuFilter] = useState("");
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const vendorNames = useMemo(() => uniqueSorted(vendors), [vendors]);
  const districtNames = useMemo(() => uniqueSorted(districts), [districts]);
  const societyNames = useMemo(() => uniqueSorted(societies), [societies]);

  const groups = useMemo((): PartySuggestionGroup[] => {
    const master = new Set([...vendorNames, ...districtNames, ...societyNames]);
    const recent = readCustomParties().filter((name) => !master.has(name));
    const q = open ? menuFilter : "";
    return [
      { id: "vendor", label: "Vendor", names: filterNames(vendorNames, q) },
      { id: "district", label: "District", names: filterNames(districtNames, q) },
      { id: "society", label: "Society", names: filterNames(societyNames, q) },
      { id: "recent", label: "Recent", names: filterNames(recent, q) },
    ];
  }, [vendorNames, districtNames, societyNames, menuFilter, open]);

  const hasVisibleOptions = groups.some((group) => group.names.length > 0);

  function closeMenu() {
    setOpen(false);
    setMenuFilter("");
  }

  function placeMenu() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    const gap = 6;
    const viewportPad = 8;
    const preferredMax = 280;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - gap - viewportPad;
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;

    if (openUpward) {
      const maxHeight = Math.min(preferredMax, Math.max(80, spaceAbove));
      setBox({
        top: rect.top - gap - maxHeight,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
      return;
    }

    const maxHeight = Math.min(preferredMax, Math.max(80, spaceBelow));
    setBox({
      top: rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }

  function openMenu(showAll = true) {
    setMenuFilter(showAll ? "" : value);
    placeMenu();
    setOpen(true);
  }

  function pick(name: string) {
    onChange(name);
    closeMenu();
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
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

  return (
    <div className="select-field" ref={rootRef}>
      <div
        className="input-field select-field-trigger select-field-trigger-combobox"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
      >
        <input
          ref={inputRef}
          name={name}
          type="text"
          required={required}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          className="select-field-combobox-input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            setMenuFilter(next);
            if (!open) openMenu(false);
          }}
          onFocus={() => {
            if (!open) openMenu(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          className="select-field-combobox-chevron"
          aria-label={open ? "Close suggestions" : "Show suggestions"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) closeMenu();
            else openMenu(true);
          }}
        >
          <Chevron open={open} />
        </button>
      </div>
      {open && box
        ? createPortal(
            <div
              ref={menuRef}
              className="select-field-menu is-fixed overflow-y-auto overscroll-contain"
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
              }}
              onWheel={(event) => event.stopPropagation()}
            >
              <ul className="py-1" id={listId} role="listbox">
                {!hasVisibleOptions ? (
                  <li className="select-field-empty px-3 py-2 text-sm text-muted">
                    {menuFilter.trim() ? "No matches — use what you typed" : "Type a party name or pick a suggestion"}
                  </li>
                ) : (
                  groups.map((group) =>
                    group.names.length === 0 ? null : (
                      <li key={group.id} role="presentation">
                        <div className="px-3 pb-0.5 pt-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted">
                          {group.label}
                        </div>
                        <ul role="group" aria-label={group.label}>
                          {group.names.map((label) => {
                            const selected = label === value;
                            return (
                              <li key={`${group.id}-${label}`}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  className={selected ? "is-selected" : undefined}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => pick(label)}
                                >
                                  <span className="truncate">{label}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ),
                  )
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
