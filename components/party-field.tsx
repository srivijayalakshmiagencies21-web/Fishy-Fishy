"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readCustomParties, readPcCustomParties } from "@/lib/finance-party-memory";
import { computeMenuBox, trackMenuPlacement, type MenuBox } from "@/lib/floating-menu";

const MENU_MAX_HEIGHT = 280;

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
  vendorsOnly = false,
  districtsOnly = false,
  societiesOnly = false,
  partyRecentsScope = "global",
  enforceVendorList = false,
  enforcePickList = false,
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
  /** Hide district, society, and recent suggestions — vendor list only. */
  vendorsOnly?: boolean;
  /** Hide vendor, society, and recent suggestions — district list only. */
  districtsOnly?: boolean;
  /** Society suggestions (+ PC recents when `partyRecentsScope` is pc); typing still allowed. */
  societiesOnly?: boolean;
  partyRecentsScope?: "global" | "pc";
  /** Party must match a vendor name in `vendors` (case-insensitive). */
  enforceVendorList?: boolean;
  /** Party must match vendors or districts per `vendorsOnly` / `districtsOnly`. */
  enforcePickList?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  /** Filters the suggestion menu only; empty string shows full Vendor / District / Society lists. */
  const [menuFilter, setMenuFilter] = useState("");
  const [box, setBox] = useState<MenuBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const vendorNames = useMemo(() => uniqueSorted(vendors), [vendors]);
  const districtNames = useMemo(() => uniqueSorted(districts), [districts]);
  const societyNames = useMemo(() => uniqueSorted(societies), [societies]);

  const groups = useMemo((): PartySuggestionGroup[] => {
    const q = open ? menuFilter : "";
    if (districtsOnly) {
      return [{ id: "district", label: "District", names: filterNames(districtNames, q) }];
    }
    if (societiesOnly) {
      const master = new Set(societyNames);
      const recents =
        partyRecentsScope === "pc" ? readPcCustomParties() : readCustomParties();
      const recent = recents.filter((name) => !master.has(name));
      return [
        { id: "society", label: "Society", names: filterNames(societyNames, q) },
        { id: "recent", label: "Recent", names: filterNames(recent, q) },
      ];
    }
    if (vendorsOnly) {
      return [{ id: "vendor", label: "Vendor", names: filterNames(vendorNames, q) }];
    }
    const master = new Set([...vendorNames, ...districtNames, ...societyNames]);
    const recent = readCustomParties().filter((name) => !master.has(name));
    return [
      { id: "vendor", label: "Vendor", names: filterNames(vendorNames, q) },
      { id: "district", label: "District", names: filterNames(districtNames, q) },
      { id: "society", label: "Society", names: filterNames(societyNames, q) },
      { id: "recent", label: "Recent", names: filterNames(recent, q) },
    ];
  }, [
    vendorNames,
    districtNames,
    societyNames,
    menuFilter,
    open,
    vendorsOnly,
    districtsOnly,
    societiesOnly,
    partyRecentsScope,
  ]);

  const hasVisibleOptions = groups.some((group) => group.names.length > 0);

  function closeMenu() {
    setOpen(false);
    setMenuFilter("");
  }

  function placeMenu() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox(computeMenuBox(rect, MENU_MAX_HEIGHT));
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

  const mustEnforcePick = enforcePickList || enforceVendorList;

  useEffect(() => {
    const el = inputRef.current;
    if (!el || !mustEnforcePick) return;
    const q = value.trim().toLowerCase();
    if (!q) {
      el.setCustomValidity("");
      return;
    }
    const allowed = districtsOnly ? districtNames : vendorNames;
    const ok = allowed.some((name) => name.toLowerCase() === q);
    const message = districtsOnly
      ? "Pick a district from the list for this category."
      : "Pick a vendor from the list for this category.";
    el.setCustomValidity(ok ? "" : message);
  }, [value, mustEnforcePick, districtsOnly, vendorNames, districtNames]);

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

    const stopTracking = trackMenuPlacement(rootRef.current, MENU_MAX_HEIGHT, placeMenu);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      stopTracking();
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
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
                    {menuFilter.trim()
                      ? vendorsOnly || districtsOnly
                        ? districtsOnly
                          ? "No matching districts"
                          : "No matching vendors"
                        : "No matches — use what you typed"
                      : districtsOnly
                        ? "Pick a district from the list"
                        : societiesOnly
                          ? "Type or pick a society"
                          : vendorsOnly
                            ? "Pick a vendor from the list"
                            : "Type a party name or pick a suggestion"}
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
