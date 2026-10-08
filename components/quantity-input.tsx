"use client";

import type { ChangeEvent, WheelEvent } from "react";

export function parseQuantityDigits(raw: string): number | "" {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  const n = Number(digits);
  return Number.isFinite(n) ? n : "";
}

export function quantityDisplayValue(value: number | ""): string {
  return value === "" ? "" : String(value);
}

export function QuantityInput({
  value,
  onChange,
  className,
  placeholder,
  required,
  disabled,
  title,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      disabled={disabled}
      title={title}
      placeholder={placeholder}
      className={className}
      value={quantityDisplayValue(value)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseQuantityDigits(e.target.value))}
      onWheel={(e: WheelEvent<HTMLInputElement>) => e.currentTarget.blur()}
    />
  );
}
