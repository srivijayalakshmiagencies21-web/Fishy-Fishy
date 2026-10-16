import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import {
  FINANCIAL_YEAR_COOKIE,
  financialYearIdForDate,
  mapFinancialYearRow,
  type FinancialYear,
} from "@/lib/financial-year";
import { createClient } from "@/lib/supabase/server";
import { todayIsoDate } from "@/lib/transactions";
import { noSkipCache, type ServerSupabase, type SkipCache } from "@/lib/workspace-cache.server";

export const loadFinancialYears = cache(async (): Promise<FinancialYear[]> => {
  return fetchFinancialYears(await createClient());
});

export async function fetchFinancialYears(
  supabase: ServerSupabase,
  skipCache: SkipCache = noSkipCache,
): Promise<FinancialYear[]> {
  const { data, error } = await supabase
    .from("financial_years")
    .select("id, label, start_date, end_date")
    .order("start_date", { ascending: true });

  if (error) {
    console.error("[financial-year] load years failed:", error.message);
    skipCache();
    return [];
  }

  return (data ?? []).map(mapFinancialYearRow);
}

export async function loadTaggedDistrictIdsForYear(financialYearId: number): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("financial_year_districts")
    .select("district_id")
    .eq("financial_year_id", financialYearId);

  if (error) {
    console.error("[financial-year] load tagged districts failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: { district_id: number }) => row.district_id);
}

export async function resolveSelectedFinancialYearId(years: FinancialYear[]): Promise<number | null> {
  if (years.length === 0) return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get(FINANCIAL_YEAR_COOKIE)?.value;
  const fromCookie = raw ? Number(raw) : NaN;
  if (Number.isFinite(fromCookie) && years.some((y) => y.id === fromCookie)) {
    return fromCookie;
  }

  return financialYearIdForDate(years, todayIsoDate());
}

export async function getFinancialYearContext(): Promise<{
  years: FinancialYear[];
  selectedYearId: number | null;
  selectedYear: FinancialYear | null;
}> {
  const years = await loadFinancialYears();
  const selectedYearId = await resolveSelectedFinancialYearId(years);
  const selectedYear = selectedYearId != null ? years.find((y) => y.id === selectedYearId) ?? null : null;
  return { years, selectedYearId, selectedYear };
}
