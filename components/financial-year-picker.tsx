"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { selectFinancialYear } from "@/app/(workspace)/financial-year/actions";
import { SelectField } from "@/components/select-field";
import type { FinancialYear } from "@/lib/financial-year";

export function FinancialYearPicker({
  years,
  selectedYearId,
  autoSelectWhenSingle = false,
}: {
  years: FinancialYear[];
  selectedYearId: number | null;
  autoSelectWhenSingle?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [optimisticYearId, setOptimisticYearId] = useOptimistic(selectedYearId);

  const options = useMemo(
    () => years.map((year) => ({ value: String(year.id), label: `FY ${year.label}` })),
    [years],
  );

  function onPick(value: string) {
    const nextId = Number(value);
    if (!Number.isFinite(nextId) || nextId === optimisticYearId) return;
    startTransition(async () => {
      setOptimisticYearId(nextId);
      // Setting the FY cookie re-renders the current route in the same response — no router.refresh needed.
      await selectFinancialYear(nextId);
    });
  }

  const disabled = years.length === 0;
  const value = optimisticYearId != null ? String(optimisticYearId) : "";

  return (
    <div className="w-full min-w-0" title="Financial year">
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
  );
}
