"use server";

import {
  revalidateFinancialYearSelection,
  revalidateFinancialYearViews,
  setSelectedFinancialYearCookie,
} from "@/lib/revalidate-financial-year.server";
import { financialYearFromAprilStartYear } from "@/lib/financial-year";
import { loadFinancialYears } from "@/lib/financial-year.server";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function selectFinancialYear(financialYearId: number): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to choose a financial year." };

  const years = await loadFinancialYears();
  if (!years.some((y) => y.id === financialYearId)) {
    return { error: "Unknown financial year." };
  }

  await setSelectedFinancialYearCookie(financialYearId);
  revalidateFinancialYearSelection();
  return {};
}

export type CreateFinancialYearState = { error: string } | { ok: true; id: number } | null;

export async function createFinancialYear(
  _state: CreateFinancialYearState,
  formData: FormData,
): Promise<CreateFinancialYearState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to add a financial year." };
  if (!user.pages.includes("vendor-govt-rates")) {
    return { error: "Not allowed to add financial years." };
  }

  const startYear = Number(String(formData.get("start_year") ?? "").trim());
  const spec = financialYearFromAprilStartYear(startYear);
  if (!spec) return { error: "Enter a valid April start year (e.g. 2028)." };

  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("financial_years")
    .insert({
      label: spec.label,
      start_date: spec.startDate,
      end_date: spec.endDate,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: `Financial year ${spec.label} already exists.` };
    return { error: error.message };
  }

  await setSelectedFinancialYearCookie(data.id as number);
  revalidateFinancialYearViews();
  return { ok: true, id: data.id as number };
}

export type FinancialYearDistrictsState = { error: string } | { ok: true } | null;

export async function saveFinancialYearDistricts(
  _state: FinancialYearDistrictsState,
  formData: FormData,
): Promise<FinancialYearDistrictsState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to save." };
  if (!user.pages.includes("vendor-govt-rates")) {
    return { error: "Not allowed to edit govt rates setup." };
  }

  const financialYearId = Number(formData.get("financial_year_id"));
  if (!Number.isFinite(financialYearId)) return { error: "Missing financial year." };

  const years = await loadFinancialYears();
  if (!years.some((y) => y.id === financialYearId)) return { error: "Unknown financial year." };

  const districtIds = [
    ...new Set(
      formData
        .getAll("district_id")
        .map((value) => Number(value))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];

  const supabase = await createClient();

  const { data: validDistricts, error: districtError } = await supabase.from("districts").select("id");
  if (districtError) return { error: districtError.message };

  const validIds = new Set((validDistricts ?? []).map((row) => row.id));
  for (const id of districtIds) {
    if (!validIds.has(id)) return { error: "One or more districts are invalid." };
  }

  const { error: deleteError } = await (supabase as any)
    .from("financial_year_districts")
    .delete()
    .eq("financial_year_id", financialYearId);

  if (deleteError) return { error: deleteError.message };

  if (districtIds.length > 0) {
    const { error: insertError } = await (supabase as any).from("financial_year_districts").insert(
      districtIds.map((district_id) => ({
        financial_year_id: financialYearId,
        district_id,
      })),
    );
    if (insertError) return { error: insertError.message };
  }

  revalidateFinancialYearViews();
  return { ok: true };
}
