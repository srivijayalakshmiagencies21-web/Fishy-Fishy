"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type JourneyRateActionState = { error: string } | null;

export async function saveJourneyRateLine(
  _state: JourneyRateActionState,
  formData: FormData,
): Promise<JourneyRateActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to save rates." };
  if (!user.pages.includes("journey-rates")) return { error: "Not allowed to edit journey rates." };

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

  revalidatePath("/journey-rates");
  return null;
}
