import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Sum of income (`in`) transaction amounts per district for a financial year. */
export async function loadIncomeReceivedByDistrictForYear(
  financialYearId: number | null,
): Promise<Record<number, number>> {
  if (financialYearId == null) return {};

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("transactions")
    .select("amount, district_id")
    .eq("type", "in")
    .eq("financial_year_id", financialYearId);

  if (error) {
    console.error("[overview] load income received failed:", error.message);
    return {};
  }

  const byDistrict: Record<number, number> = {};
  for (const row of data ?? []) {
    const districtId = row.district_id;
    const amount = Number(row.amount);
    if (districtId == null || !Number.isFinite(amount) || amount <= 0) continue;
    byDistrict[districtId] = (byDistrict[districtId] ?? 0) + amount;
  }
  return byDistrict;
}
