"use server";

import { revalidatePath } from "next/cache";
import { readableError } from "@/lib/masters";
import { loadFinanceCategories, type FinanceCategoryScope } from "@/lib/transactions.server";
import { getSessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  isCashPaymentMode,
  mapTransactionEndpointsToDb,
  transactionAllocationFields,
  transactionTouchesAccountIds,
  type TxnType,
} from "@/lib/transactions";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function linkedAccountIdsForUser(supabase: SupabaseServer, userId: string) {
  const { data, error } = await supabase.from("accounts").select("id").eq("linked_user_id", userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.id));
}

function assertAccountsLinkedToUser(
  accountIds: number[],
  allowed: ReadonlySet<number>,
): FormState | null {
  if (allowed.size === 0) {
    return fail("No accounts are linked to your user. Ask an admin to link accounts in Masters.");
  }
  if (!accountIds.every((id) => allowed.has(id))) {
    return fail("Choose only accounts linked to your user.");
  }
  return null;
}

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

type CategoryRow = {
  name: string;
  transaction_type: string;
  cost_nature: string;
  default_allocation: string;
  active: boolean;
};

function categoryScopeFromForm(formData: FormData, pages: string[]): FinanceCategoryScope | null {
  const raw = text(formData, "category_scope");
  if (raw === "full") {
    return pages.includes("finance-manager") ? "full" : null;
  }
  if (raw === "role") {
    return pages.includes("finance-executive") ? "role" : null;
  }
  if (pages.includes("finance-manager")) return "full";
  if (pages.includes("finance-executive")) return "role";
  return null;
}

async function loadCategories(scope: FinanceCategoryScope) {
  const supabase = await createClient();
  const rows = await loadFinanceCategories(supabase, scope);
  return rows.map(({ name, transaction_type, cost_nature, default_allocation, active }) => ({
    name,
    transaction_type,
    cost_nature,
    default_allocation,
    active,
  })) as CategoryRow[];
}

function categoryAllowed(
  name: string,
  type: TxnType,
  rows: Pick<CategoryRow, "name" | "transaction_type" | "active">[],
) {
  const cat = rows.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!cat || !cat.active) return false;
  if (type === "transfer") return cat.transaction_type === "both";
  return cat.transaction_type === type;
}

export async function createTransaction(_state: FormState, formData: FormData): Promise<FormState> {
  const type = text(formData, "type") as TxnType;
  const txn_date = text(formData, "txn_date");
  const amount = parseAmount(text(formData, "amount"));
  const category = text(formData, "category");
  const payment_mode = text(formData, "payment_mode");
  const remarks = text(formData, "remarks");
  const journeyRaw = text(formData, "journey_id");
  let journey_id = journeyRaw || null;
  let district_id = Number(formData.get("district_id"));

  if (!TXN_TYPES.has(type)) return fail("Choose a valid transaction type.");
  if (!txn_date) return fail("Choose a date.");
  if (amount == null) return fail("Enter a valid amount.");
  if (!payment_mode) return fail("Choose a payment mode.");

  const mapped = mapTransactionEndpointsToDb(type, text(formData, "from_value"), text(formData, "to_value"));
  if ("error" in mapped) return fail(mapped.error);

  const { account_id, to_account_id, party } = mapped;

  if (type === "transfer") {
    journey_id = null;
    district_id = NaN;
  }

  if (!category) return fail("Choose a category.");
  const user = await getSessionUser();
  if (!user) return fail("Sign in to save transactions.");
  const categoryScope = categoryScopeFromForm(formData, user.pages);
  if (!categoryScope) return fail("Not allowed to save on this finance page.");

  let categories: CategoryRow[];
  try {
    categories = await loadCategories(categoryScope);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not load categories.");
  }
  if (!categoryAllowed(category, type, categories)) {
    return fail("Choose a category that matches this transaction type.");
  }

  const categoryRow = categories.find((row) => row.name.toLowerCase() === category.toLowerCase());
  const allocation =
    type === "transfer"
      ? { showDistrict: false, showJourney: false, requireDistrict: false }
      : transactionAllocationFields(
          categoryRow
            ? {
                cost_nature: categoryRow.cost_nature,
                default_allocation: categoryRow.default_allocation as "company" | "project",
              }
            : null,
        );

  if (!allocation.showDistrict) {
    district_id = NaN;
    journey_id = null;
  } else if (!allocation.showJourney) {
    journey_id = null;
  }

  if (allocation.requireDistrict) {
    if (!Number.isFinite(district_id) || district_id <= 0) return fail("Choose a district.");
  }

  const supabase = await createClient();

  if (categoryScope === "role") {
    try {
      const linkedIds = await linkedAccountIdsForUser(supabase, user.id);
      const txnAccountIds =
        type === "transfer" ? [account_id, to_account_id!] : [account_id];
      const linkError = assertAccountsLinkedToUser(txnAccountIds, linkedIds);
      if (linkError) return linkError;
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Could not verify linked accounts.");
    }
  }

  {
    const accountIds =
      type === "transfer"
        ? [account_id, to_account_id!]
        : [account_id];
    const { data: accountRows, error: accountError } = await supabase
      .from("accounts")
      .select("id, account_type")
      .in("id", accountIds);
    if (accountError || !accountRows || accountRows.length !== accountIds.length) {
      return fail("Choose valid accounts for this payment mode.");
    }
    const requiredType = isCashPaymentMode(payment_mode) ? "wallet" : "account";
    const paymentAccountId = account_id;
    const payRow = accountRows.find((row) => row.id === paymentAccountId);
    if (!payRow || payRow.account_type !== requiredType) {
      return fail(
        requiredType === "wallet"
          ? "Cash payments must use wallet accounts on the account side."
          : "This payment mode must use bank accounts on the account side.",
      );
    }
    if (type === "transfer") {
      const fromRow = accountRows.find((row) => row.id === to_account_id);
      if (!fromRow) return fail("Choose valid accounts for this transfer.");
    }
  }

  if (allocation.showJourney && journey_id) {
    const { data: trucks, error: journeyError } = await supabase
      .from("journey_trucks")
      .select("district_id")
      .eq("journey_id", journey_id);
    if (journeyError) return fail("Choose a valid journey.");
    const districtIds = new Set(
      (trucks ?? [])
        .map((row) => row.district_id)
        .filter((id): id is number => typeof id === "number" && id > 0),
    );
    if (districtIds.size === 0) return fail("Choose a valid journey.");
    if (!districtIds.has(district_id)) {
      return fail("That journey does not belong to the selected district.");
    }
  }

  const { error } = await supabase.from("transactions").insert({
    type,
    txn_date,
    account_id,
    to_account_id,
    amount,
    category,
    payment_mode,
    party,
    remarks,
    journey_id: allocation.showJourney ? journey_id : null,
    district_id:
      allocation.showDistrict && Number.isFinite(district_id) && district_id > 0 ? district_id : null,
    created_by: user.id || null,
  });

  if (error) return fail(error.message);

  revalidatePath("/finance-manager");
  revalidatePath("/finance-executive");
  return null;
}

export async function deleteTransaction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;

  const user = await getSessionUser();
  if (!user) return;

  const supabase = await createClient();

  if (user.pages.includes("finance-executive") && !user.pages.includes("finance-manager")) {
    const { data: row, error: loadError } = await supabase
      .from("transactions")
      .select("account_id, to_account_id")
      .eq("id", id)
      .maybeSingle();
    if (loadError || !row) return;

    try {
      const linkedIds = await linkedAccountIdsForUser(supabase, user.id);
      if (!transactionTouchesAccountIds(row, linkedIds)) return;
    } catch {
      return;
    }
  }

  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/finance-manager");
  revalidatePath("/finance-executive");
}
