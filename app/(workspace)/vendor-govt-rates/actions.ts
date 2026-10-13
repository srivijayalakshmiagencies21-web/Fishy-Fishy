"use server";

import { revalidatePath } from "next/cache";
import { loadFinancialYears } from "@/lib/financial-year.server";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type JourneyRateActionState = { error: string } | null;

export async function saveJourneyRateLine(
  _state: JourneyRateActionState,
  formData: FormData,
): Promise<JourneyRateActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to save rates." };
  if (!user.pages.includes("vendor-govt-rates")) {
    return { error: "Not allowed to edit vendor & govt rates." };
  }

  const journeyId = String(formData.get("journey_id") ?? "").trim();
  const lineKey = String(formData.get("line_key") ?? "").trim();
  const rateRaw = String(formData.get("rate") ?? "").trim();

  if (!journeyId || !lineKey) return { error: "Missing journey line." };

  let rate: number | null = null;
  if (rateRaw) {
    const parsed = Number(rateRaw);
    if (!Number.isFinite(parsed) || parsed < 0) return { error: "Enter a valid rate." };
    rate = parsed;
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).from("journey_rate_lines").upsert(
    {
      journey_id: journeyId,
      line_key: lineKey,
      rate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "journey_id,line_key" },
  );

  if (error) return { error: error.message };

  revalidatePath("/vendor-govt-rates");
  return null;
}

function assertGovtRatesAccess(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return "Sign in to continue.";
  if (!user.pages.includes("vendor-govt-rates")) return "Not allowed to edit govt rates.";
  return null;
}

export type GovtLedgerFormState = { error: string } | { ok: true } | null;

export async function createGovtLedgerRow(
  _state: GovtLedgerFormState,
  formData: FormData,
): Promise<GovtLedgerFormState> {
  const user = await getSessionUser();
  const denied = assertGovtRatesAccess(user);
  if (denied) return { error: denied };

  const financialYearId = Number(formData.get("financial_year_id"));

  const pairKeys = new Set<string>();
  const pairs: { districtId: number; companyId: number }[] = [];

  for (const raw of formData.getAll("pair")) {
    const text = String(raw);
    const sep = text.indexOf(":");
    if (sep <= 0) continue;
    const districtId = Number(text.slice(0, sep));
    const companyId = Number(text.slice(sep + 1));
    if (!Number.isFinite(districtId) || !Number.isFinite(companyId)) continue;
    const key = `${districtId}:${companyId}`;
    if (pairKeys.has(key)) continue;
    pairKeys.add(key);
    pairs.push({ districtId, companyId });
  }

  if (!Number.isFinite(financialYearId)) return { error: "Choose a financial year." };
  if (pairs.length === 0) {
    return { error: "For each district, select at least one company." };
  }

  const years = await loadFinancialYears();
  if (!years.some((y) => y.id === financialYearId)) return { error: "Unknown financial year." };

  const supabase = await createClient();

  const districtIds = [...new Set(pairs.map((pair) => pair.districtId))];
  const companyIds = [...new Set(pairs.map((pair) => pair.companyId))];

  const { data: links, error: linkError } = await supabase
    .from("district_companies")
    .select("district_id, company_id")
    .in("district_id", districtIds)
    .in("company_id", companyIds);

  if (linkError) return { error: linkError.message };

  const validPairs = new Set(
    (links ?? []).map((row) => `${row.district_id}:${row.company_id}`),
  );

  const companiesByDistrict = new Map<number, number[]>();
  for (const { districtId, companyId } of pairs) {
    if (!validPairs.has(`${districtId}:${companyId}`)) continue;
    const list = companiesByDistrict.get(districtId);
    if (list) list.push(companyId);
    else companiesByDistrict.set(districtId, [companyId]);
  }

  if (companiesByDistrict.size === 0) {
    return {
      error:
        "Selected companies are not tagged to those districts in Masters → Districts.",
    };
  }

  for (const [districtId, companyIds] of companiesByDistrict) {
    const uniqueCompanyIds = [...new Set(companyIds)];

    const { data: ledgerRow, error: ledgerError } = await (supabase as any)
      .from("govt_rate_ledger")
      .upsert(
        {
          financial_year_id: financialYearId,
          district_id: districtId,
        },
        { onConflict: "financial_year_id,district_id" },
      )
      .select("id")
      .single();

    if (ledgerError) return { error: ledgerError.message };

    const ledgerId = ledgerRow.id as number;

    const { error: clearError } = await (supabase as any)
      .from("govt_rate_ledger_companies")
      .delete()
      .eq("ledger_id", ledgerId);

    if (clearError) return { error: clearError.message };

    const { error: companiesError } = await (supabase as any).from("govt_rate_ledger_companies").insert(
      uniqueCompanyIds.map((companyId) => ({
        ledger_id: ledgerId,
        company_id: companyId,
      })),
    );

    if (companiesError) return { error: companiesError.message };
  }

  revalidatePath("/vendor-govt-rates");
  return { ok: true };
}

export type GovtLedgerFieldState = { error: string } | null;

export async function updateGovtLedgerField(
  _state: GovtLedgerFieldState,
  formData: FormData,
): Promise<GovtLedgerFieldState> {
  const user = await getSessionUser();
  const denied = assertGovtRatesAccess(user);
  if (denied) return { error: denied };

  const id = Number(formData.get("ledger_id"));
  const field = String(formData.get("field") ?? "");
  const raw = String(formData.get("value") ?? "").trim();

  if (!Number.isFinite(id)) return { error: "Missing row." };
  if (field !== "rate" && field !== "govt_recorded_qty" && field !== "govt_allotted_qty") {
    return { error: "Invalid field." };
  }

  let value: number | null = null;
  if (field === "govt_recorded_qty") {
    value = parseOptionalRecordedQty(raw);
  } else if (raw) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return { error: "Enter a valid number." };
    value = parsed;
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("govt_rate_ledger")
    .update({
      [field]: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/vendor-govt-rates");
  return null;
}

export type GovtLedgerBatchState = { error: string } | { ok: true } | null;

type GovtLedgerBatchUpdate = {
  ledger_id: number;
  rate?: string | null;
  govt_recorded_qty?: string | null;
  govt_allotted_qty?: string | null;
};

function parseOptionalNonNegativeNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return parsed;
}

/** Recorded qty is optional — blank or invalid input is stored as null. */
function parseOptionalRecordedQty(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export async function saveGovtLedgerBatch(
  _state: GovtLedgerBatchState,
  formData: FormData,
): Promise<GovtLedgerBatchState> {
  const user = await getSessionUser();
  const denied = assertGovtRatesAccess(user);
  if (denied) return { error: denied };

  let updates: GovtLedgerBatchUpdate[] = [];
  try {
    updates = JSON.parse(String(formData.get("updates") ?? "[]")) as GovtLedgerBatchUpdate[];
  } catch {
    return { error: "Invalid save payload." };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { error: "Nothing to save." };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  for (const entry of updates) {
    const id = Number(entry.ledger_id);
    if (!Number.isFinite(id)) return { error: "Invalid ledger row." };

    const patch: Record<string, number | null | string> = { updated_at: now };
    if ("rate" in entry) {
      const rate = parseOptionalNonNegativeNumber(entry.rate);
      if (Number.isNaN(rate)) return { error: "Enter a valid govt rate." };
      patch.rate = rate;
    }
    if ("govt_recorded_qty" in entry) {
      patch.govt_recorded_qty = parseOptionalRecordedQty(entry.govt_recorded_qty);
    }
    if ("govt_allotted_qty" in entry) {
      const qty = parseOptionalNonNegativeNumber(entry.govt_allotted_qty);
      if (Number.isNaN(qty)) return { error: "Enter a valid govt allotted qty." };
      patch.govt_allotted_qty = qty;
    }

    const { error } = await (supabase as any).from("govt_rate_ledger").update(patch).eq("id", id);
    if (error) return { error: error.message };
  }

  revalidatePath("/vendor-govt-rates");
  return { ok: true };
}
