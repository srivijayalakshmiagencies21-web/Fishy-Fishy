"use server";

import { revalidatePath } from "next/cache";
import { readableError } from "@/lib/masters";
import { createClient } from "@/lib/supabase/server";
import type { TxnType } from "@/lib/transactions";

export type FormState = { error: string } | null;

const TXN_TYPES = new Set<TxnType>(["in", "out", "transfer"]);

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fail(message: string): FormState {
  return { error: readableError(message) };
}

function parseAmount(raw: string) {
  const normalized = raw.replace(/,/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

async function categoryNames() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transaction_categories").select("name, transaction_type, active");
  if (error) throw new Error(error.message);
  return data ?? [];
}

function categoryAllowed(
  name: string,
  type: TxnType,
  rows: { name: string; transaction_type: string; active: boolean }[],
) {
  const cat = rows.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!cat || !cat.active) return false;
  if (type === "transfer") return cat.transaction_type === "both";
  return cat.transaction_type === type;
}

export async function createTransaction(_state: FormState, formData: FormData): Promise<FormState> {
  const type = text(formData, "type") as TxnType;
  const txn_date = text(formData, "txn_date");
  const account_id = Number(formData.get("account_id"));
  const to_account_id = Number(formData.get("to_account_id"));
  const amount = parseAmount(text(formData, "amount"));
  let category = text(formData, "category");
  const payment_mode = text(formData, "payment_mode");
  let party = text(formData, "party");
  const remarks = text(formData, "remarks");
  let journeyRaw = text(formData, "journey_id");
  let journey_id = journeyRaw || null;

  if (!TXN_TYPES.has(type)) return fail("Choose a valid transaction type.");
  if (!txn_date) return fail("Choose a date.");
  if (!Number.isFinite(account_id) || account_id <= 0) return fail("Choose an account.");
  if (amount == null) return fail("Enter a valid amount.");
  if (!payment_mode) return fail("Choose a payment mode.");

  if (type === "transfer") {
    if (!Number.isFinite(to_account_id) || to_account_id <= 0) return fail("Choose the account to transfer to.");
    if (to_account_id === account_id) return fail("Transfer accounts must be different.");
    party = "";
    journey_id = null;
  }

  if (!category) return fail("Choose a category.");
  let categories: Awaited<ReturnType<typeof categoryNames>>;
  try {
    categories = await categoryNames();
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not load categories.");
  }
  if (!categoryAllowed(category, type, categories)) {
    return fail("Choose a category that matches this transaction type.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("transactions").insert({
    type,
    txn_date,
    account_id,
    to_account_id: type === "transfer" ? to_account_id : null,
    amount,
    category,
    payment_mode,
    party,
    remarks,
    journey_id,
    created_by: user?.id ?? null,
  });

  if (error) return fail(error.message);

  revalidatePath("/finance");
  return null;
}

export async function deleteTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;

  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/finance");
}
