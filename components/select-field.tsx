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
  value: controlledValue,
  defaultValue,
  required = false,
  onChange,
  onChangeMultiple,
  compact = false,
  integrated = false,
  placeholder = "Select",
  multiple = false,
  valueMultiple = [],
  showCountOnly = false,
  disabled = false,
  autoSelectWhenSingle = true,
}: {
  name?: string;
  options: SelectOption[];
  /** When set, selection is controlled by the parent (recommended for forms that keep ids in state). */
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  onChangeMultiple?: (values: string[]) => void;
  compact?: boolean;
  integrated?: boolean;
  placeholder?: string;
  multiple?: boolean;
  valueMultiple?: string[];
  showCountOnly?: boolean;
  disabled?: boolean;
  /** When true, the sole option is selected automatically; with 2+ options the user must choose. */
  autoSelectWhenSingle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(() => {
    if (defaultValue) return defaultValue;
    if (autoSelectWhenSingle && options.length === 1) return options[0].value;
    return "";
  });
  const value = isControlled ? controlledValue : internalValue;
  const soleOption =
    !multiple && autoSelectWhenSingle && options.length === 1 ? options[0] : null;
  const fieldValue = value || soleOption?.value || "";
  const [selectedMulti, setSelectedMulti] = useState<string[]>(valueMultiple);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const optionValuesKey = options.map((option) => option.value).join("\0");
  const lastAutoSingleRef = useRef<string | null>(null);

  function commitSingle(next: string) {
    if (!isControlled) setInternalValue(next);
    onChangeRef.current?.(next);
  }

  // Keep internal multi state in sync if prop changes
  useEffect(() => {
    setSelectedMulti(prev => {
      if (JSON.stringify(prev) === JSON.stringify(valueMultiple)) return prev;
      return valueMultiple;
    });
  }, [valueMultiple]);

  // Uncontrolled: parent defaultValue can update after first mount (e.g. draft restore).
  useEffect(() => {
    if (isControlled || multiple || !defaultValue) return;
    if (!options.some((option) => option.value === defaultValue)) return;
    setInternalValue((prev) => (prev === defaultValue ? prev : defaultValue));
  }, [defaultValue, isControlled, multiple, optionValuesKey]);

  useEffect(() => {
    if (multiple || disabled || !autoSelectWhenSingle) return;

    if (options.length === 1) {
      const only = options[0].value;
      if (!isControlled) setInternalValue(only);
      if (lastAutoSingleRef.current !== only) {
        lastAutoSingleRef.current = only;
        onChangeRef.current?.(only);
      }
      return;
    }

    lastAutoSingleRef.current = null;
    if (isControlled) return;

    setInternalValue((prev) => {
      if (!prev || options.some((option) => option.value === prev)) return prev;
      onChangeRef.current?.("");
      return "";
    });
  }, [optionValuesKey, options.length, multiple, disabled, autoSelectWhenSingle, isControlled]);

  const selected = options.find((option) => option.value === fieldValue);
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

  const rootClass = [
    "select-field",
    compact && !integrated ? "select-field--compact" : "",
    integrated ? "min-w-0 flex-1 flex justify-end" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const triggerClass = [
    "input-field select-field-trigger",
    integrated
      ? "!min-h-0 !h-auto !w-auto !max-w-full !border-0 !bg-transparent !p-0 !pl-3 !shadow-none !rounded-none text-sm font-medium justify-end gap-1.5 focus:!border-0 focus:!shadow-none"
      : "",
    disabled ? "disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed disabled:border-gray-200" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} ref={rootRef}>
      {!multiple && name && (
        <input type="hidden" name={name} value={fieldValue} required={required} />
      )}
      <button
        type="button"
        disabled={disabled}
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          placeMenu();
          setOpen(true);
        }}
      >
        <span className={`flex min-w-0 items-center ${integrated ? "shrink" : "flex-1"}`}>
          {!multiple ? (
            selected ? (
              <SelectOptionContent option={selected} />
            ) : (
              <span className="truncate text-muted">{placeholder}</span>
            )
          ) : selectedMultiOptions.length > 0 ? (
            <span className="truncate text-sm">
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
                const isSelected = multiple
                  ? selectedMulti.includes(option.value)
                  : option.value === fieldValue;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={isSelected ? "is-selected flex items-center justify-between w-full text-left" : "flex items-center justify-between w-full text-left"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (multiple) {
                          const newMulti = isSelected 
                            ? selectedMulti.filter(v => v !== option.value)
                            : [...selectedMulti, option.value];
                          setSelectedMulti(newMulti);
                          onChangeMultiple?.(newMulti);
                        } else {
                          commitSingle(option.value);
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
