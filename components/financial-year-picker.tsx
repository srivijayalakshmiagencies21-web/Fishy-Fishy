"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () => years.map((year) => ({ value: String(year.id), label: year.label })),
    [years],
  );

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 sm:gap-1">
      <span className="text-[0.58rem] font-bold uppercase leading-none tracking-wide text-muted sm:text-[0.65rem] sm:tracking-widest">
        Financial year
      </span>
      <SelectField
        compact
        placeholder={years.length === 0 ? "Configure FY in Govt rates" : "Select FY"}
        options={options}
        value={selectedYearId != null ? String(selectedYearId) : ""}
        disabled={pending || years.length === 0}
        autoSelectWhenSingle={autoSelectWhenSingle}
        onChange={(value) => {
          const nextId = Number(value);
          if (!Number.isFinite(nextId)) return;
          startTransition(async () => {
            const result = await selectFinancialYear(nextId);
            if (!result.error) router.refresh();
          });
        }}
      />
    </div>
  );
}
