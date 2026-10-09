"use client";

import type { ReactNode } from "react";
import { QuantityInput } from "@/components/quantity-input";

const defaultQtyClass =
  "w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-right tabular-nums font-medium text-gray-900 transition-all focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20";

/** Fish type + seed size on top, quantity input full width below — same at all breakpoints. */
export function FishQuantityRow({
  fishType,
  seedSize,
  meta,
  value,
  onChange,
  placeholder = "Qty",
  readOnly = false,
  quantityRequired,
  quantityDisabled,
  quantityTitle,
  quantityClassName = defaultQtyClass,
}: {
  fishType: string;
  seedSize?: string | null;
  meta?: ReactNode;
  value: number | "";
  onChange?: (value: number | "") => void;
  placeholder?: string;
  readOnly?: boolean;
  quantityRequired?: boolean;
  quantityDisabled?: boolean;
  quantityTitle?: string;
  quantityClassName?: string;
}) {
  const display = value === "" ? "—" : Number(value).toLocaleString();

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-rose-100 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-words text-left text-sm font-semibold leading-snug text-gray-700">
          {fishType}
        </span>
        <span className="shrink-0 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600/90">
          {seedSize?.trim() ? seedSize : "—"}
        </span>
      </div>
      {meta ? (
        <div className="min-h-[1.125rem] text-[0.65rem] font-semibold leading-snug tabular-nums text-gray-400 sm:text-xs">
          {meta}
        </div>
      ) : null}
      {readOnly ? (
        <div
          className={`${quantityClassName} cursor-default text-gray-400`}
          aria-readonly="true"
        >
          {display}
        </div>
      ) : (
        <QuantityInput
          required={quantityRequired}
          disabled={quantityDisabled}
          title={quantityTitle}
          className={quantityClassName}
          value={value}
          onChange={(next) => onChange?.(next)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
