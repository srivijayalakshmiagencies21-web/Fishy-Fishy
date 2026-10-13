"use client";

import { FinancialYearPicker } from "@/components/financial-year-picker";
import type { FinancialYear } from "@/lib/financial-year";

export function PageHeaderFinancialYear({
  years,
  selectedYearId,
}: {
  years: FinancialYear[];
  selectedYearId: number | null;
}) {
  return (
    <div className="page-header-aside page-header-aside--active">
      <FinancialYearPicker years={years} selectedYearId={selectedYearId} autoSelectWhenSingle />
    </div>
  );
}
