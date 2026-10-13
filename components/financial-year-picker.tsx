"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { selectFinancialYear } from "@/app/(workspace)/financial-year/actions";
import { SelectField } from "@/components/select-field";
import type { FinancialYear } from "@/lib/financial-year";

const nativeSelectClass =
  "input-field !h-9 !min-h-9 w-full max-w-full py-0 text-sm font-semibold touch-manipulation";

export function FinancialYearPicker({
  years,
  selectedYearId,
  autoSelectWhenSingle = false,
}: {
  years: FinancialYear[];
  selectedYearId: number | null;
  autoSelectWhenSingle?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () => years.map((year) => ({ value: String(year.id), label: year.label })),
    [years],
  );

  function onPick(value: string) {
    const nextId = Number(value);
    if (!Number.isFinite(nextId)) return;
    startTransition(async () => {
      const result = await selectFinancialYear(nextId);
      if (!result.error) router.refresh();
    });
  }

  const disabled = pending || years.length === 0;
  const value = selectedYearId != null ? String(selectedYearId) : "";

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 sm:gap-1">
      <span className="text-[0.58rem] font-bold uppercase leading-none tracking-wide text-muted sm:text-[0.65rem] sm:tracking-widest">
        Financial year
      </span>
      <select
        className={`${nativeSelectClass} sm:hidden`}
        value={value}
        disabled={disabled}
        aria-label="Financial year"
        onChange={(event) => onPick(event.target.value)}
      >
        {years.length === 0 ? (
          <option value="">Configure FY in Govt rates</option>
        ) : (
          <>
            {!value ? <option value="">Select FY</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </>
        )}
      </select>
      <div className="hidden sm:block">
        <SelectField
          compact
          placeholder={years.length === 0 ? "Configure FY in Govt rates" : "Select FY"}
          options={options}
          value={value}
          disabled={disabled}
          autoSelectWhenSingle={autoSelectWhenSingle}
          onChange={onPick}
        />
      </div>
    </div>
  );
}
