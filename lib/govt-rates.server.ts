import "server-only";

import { cache } from "react";
import { mapFinancialYearRow, type FinancialYear } from "@/lib/financial-year";
import type { GovtRateLedgerRow } from "@/lib/govt-rates";
import { createClient } from "@/lib/supabase/server";

export type { GovtRateLedgerRow } from "@/lib/govt-rates";

export async function loadGovtRateLedger(): Promise<GovtRateLedgerRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("govt_rate_ledger")
    .select(
      `
      id,
      financial_year_id,
      district_id,
      rate,
      govt_recorded_qty,
      govt_allotted_qty,
      financial_years:financial_year_id ( label ),
      districts:district_id ( name ),
      govt_rate_ledger_companies (
        companies:company_id ( name )
      )
    `,
    )
    .order("financial_year_id", { ascending: true })
    .order("district_id", { ascending: true });

  if (error) {
    console.error("[govt-rates] load ledger failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const companyNames = (row.govt_rate_ledger_companies ?? [])
      .map((link: { companies?: { name?: string } }) => link.companies?.name ?? "")
      .filter((name: string) => name.length > 0)
      .sort((a: string, b: string) => a.localeCompare(b));

    return {
      id: row.id,
      financialYearId: row.financial_year_id,
      financialYearLabel: row.financial_years?.label ?? "—",
      districtId: row.district_id,
      districtName: row.districts?.name ?? "—",
      companyNames,
      rate: row.rate == null ? null : Number(row.rate),
      govtRecordedQty: row.govt_recorded_qty == null ? null : Number(row.govt_recorded_qty),
      govtAllottedQty: row.govt_allotted_qty == null ? null : Number(row.govt_allotted_qty),
    };
  });
}

/** Financial years that have at least one govt rate ledger row (Configure FY on Vendor & Govt Rates). */
export const loadFinancialYearsFromGovtLedger = cache(async (): Promise<FinancialYear[]> => {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("govt_rate_ledger")
    .select(
      `
      financial_year_id,
      financial_years:financial_year_id ( id, label, start_date, end_date )
    `,
    );

  if (error) {
    console.error("[govt-rates] load FY list failed:", error.message);
    return [];
  }

  const byId = new Map<number, FinancialYear>();
  for (const row of data ?? []) {
    const fy = row.financial_years;
    if (!fy || byId.has(fy.id)) continue;
    byId.set(fy.id, mapFinancialYearRow(fy));
  }

  return [...byId.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
});
