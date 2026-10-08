"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  badge?: string;
  badgeClass?: string;
};

function SelectOptionContent({ option }: { option: SelectOption }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate">{option.label}</span>
      {option.badge ? (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest ${option.badgeClass ?? ""}`}
        >
          {option.badge}
        </span>
      ) : null}
    </span>
  );
}

export function SelectField({
  name,
  options,
  defaultValue,
  required = false,
  onChange,
  onChangeMultiple,
  compact = false,
  placeholder = "Select",
  multiple = false,
  valueMultiple = [],
  showCountOnly = false,
}: {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  onChangeMultiple?: (values: string[]) => void;
  compact?: boolean;
  placeholder?: string;
  multiple?: boolean;
  valueMultiple?: string[];
  showCountOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue || "");
  const [selectedMulti, setSelectedMulti] = useState<string[]>(valueMultiple);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // Keep internal multi state in sync if prop changes
  useEffect(() => {
    setSelectedMulti(prev => {
      if (JSON.stringify(prev) === JSON.stringify(valueMultiple)) return prev;
      return valueMultiple;
    });
  }, [valueMultiple]);

  const selected = options.find((option) => option.value === value);
  const selectedMultiOptions = options.filter((o) => selectedMulti.includes(o.value));

  function placeMenu() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ top: rect.bottom + 6, left: rect.left, width: rect.width });
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

  return (
    <div className={`select-field ${compact ? "select-field--compact" : ""}`} ref={rootRef}>
      {!multiple && name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        type="button"
        className="input-field select-field-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          placeMenu();
          setOpen(true);
        }}
      >
        <span className="flex min-w-0 flex-1 items-center truncate">
          {!multiple ? (
            selected ? (
              <SelectOptionContent option={selected} />
            ) : (
              <span className="truncate text-muted">{placeholder}</span>
            )
          ) : selectedMultiOptions.length > 0 ? (
            <span className="truncate">
              {showCountOnly
                ? `${selectedMultiOptions.length} selected`
                : selectedMultiOptions.map((o) => o.label).join(", ")}
            </span>
          ) : (
            <span className="truncate text-muted">{placeholder}</span>
          )}
        </span>
        <Chevron open={open} />
      </button>
      {open && box
        ? createPortal(
            <ul
              ref={menuRef}
              className="select-field-menu is-fixed max-h-60 overflow-auto"
              id={listId}
              role="listbox"
              aria-multiselectable={multiple}
              style={{ top: box.top, left: box.left, width: box.width }}
            >
              {options.map((option) => {
                const isSelected = multiple ? selectedMulti.includes(option.value) : option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={isSelected ? "is-selected flex items-center justify-between w-full text-left" : "flex items-center justify-between w-full text-left"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (multiple) {
                          const newMulti = isSelected 
                            ? selectedMulti.filter(v => v !== option.value)
                            : [...selectedMulti, option.value];
                          setSelectedMulti(newMulti);
                          onChangeMultiple?.(newMulti);
                        } else {
                          setValue(option.value);
                          onChange?.(option.value);
                          setOpen(false);
                        }
                      }}
                    >
                      <SelectOptionContent option={option} />
                      {isSelected ? <CheckIcon /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-blue" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7.5" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
