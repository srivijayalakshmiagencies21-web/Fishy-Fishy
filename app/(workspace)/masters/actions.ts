"use server";

import { revalidatePath } from "next/cache";
import { invalidateMasterCache } from "@/lib/cache-tags.server";
import { loadMasterCached } from "@/lib/cached-masters.server";
import { redirect } from "next/navigation";
import type { TransporterScope, VendorType } from "@/supabase/database.types";
import { getMasterLink } from "@/lib/master-links";
import { readableError, type MasterData } from "@/lib/masters";
import { createClient } from "@/lib/supabase/server";
import { isValidMobile } from "@/lib/phone";
import { todayIsoDate } from "@/lib/transactions";

export type FormState = { error: string } | null;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fail(message: string): FormState {
  return { error: readableError(message) };
}

export async function fetchMaster(slug: string): Promise<MasterData> {
  if (!getMasterLink(slug)) {
    return { kind: "accounts", rows: [], users: [], error: "Unknown master." };
  }

  return loadMasterCached(slug);
}

async function findOrCreateNamed(
  table: "districts" | "companies",
  name: string,
) {
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from(table)
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (readError) {
    return { error: readError.message as string, id: null };
  }

  if (existing) {
    return { error: null, id: existing.id };
  }

  const { data, error } = await supabase.from(table).insert({ name }).select("id").single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save that name.", id: null };
  }

  return { error: null, id: data.id };
}

const ACCOUNT_TYPES = new Set(["account", "wallet"]);

function parseOpeningBalance(raw: string) {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function parseOpeningBalanceDate(formData: FormData) {
  const raw = text(formData, "opening_balance_date");
  return raw || todayIsoDate();
}

function parseAccountTypes(formData: FormData) {
  const types = formData
    .getAll("account_types")
    .map((value) => String(value))
    .filter((value) => ACCOUNT_TYPES.has(value));
  return [...new Set(types)];
}

function parseAccountCreate(formData: FormData):
  | { ok: false; error: string }
  | {
      ok: true;
      payload: {
        name: string;
        linked_user_id: string | null;
        account_types: string[];
        opening_balance: number;
        opening_balance_date: string;
      };
    } {
  const name = text(formData, "name");
  const linked_user_id = text(formData, "linked_user_id") || null;
  const account_types = parseAccountTypes(formData);
  const opening_balance = parseOpeningBalance(text(formData, "opening_balance"));
  const opening_balance_date = parseOpeningBalanceDate(formData);

  if (!name) return { ok: false, error: "Enter an account name." };
  if (account_types.length === 0) {
    return { ok: false, error: "Choose at least one type: Account and/or Wallet." };
  }
  if (opening_balance == null) return { ok: false, error: "Enter a valid opening balance (0 or more)." };

  return {
    ok: true,
    payload: {
      name,
      linked_user_id,
      account_types,
      opening_balance,
      opening_balance_date,
    },
  };
}

function parseAccountUpdate(formData: FormData):
  | { ok: false; error: string }
  | {
      ok: true;
      payload: {
        name: string;
        account_type: string;
        linked_user_id: string | null;
        opening_balance: number;
        opening_balance_date: string;
      };
    } {
  const name = text(formData, "name");
  const account_type = text(formData, "account_type");
  const linked_user_id = text(formData, "linked_user_id") || null;
  const opening_balance = parseOpeningBalance(text(formData, "opening_balance"));
  const opening_balance_date = parseOpeningBalanceDate(formData);

  if (!name) return { ok: false, error: "Enter an account name." };
  if (!ACCOUNT_TYPES.has(account_type)) return { ok: false, error: "Choose Account or Wallet." };
  if (opening_balance == null) return { ok: false, error: "Enter a valid opening balance (0 or more)." };

  return {
    ok: true,
    payload: {
      name,
      account_type,
      linked_user_id,
      opening_balance,
      opening_balance_date,
    },
  };
}

export async function createAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseAccountCreate(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const rows = parsed.payload.account_types.map((account_type) => ({
    name: parsed.payload.name,
    account_type,
    linked_user_id: parsed.payload.linked_user_id,
    opening_balance: parsed.payload.opening_balance,
    opening_balance_date: parsed.payload.opening_balance_date,
  }));

  const { error } = await supabase.from("accounts").insert(rows);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return fail("That name already exists for one of the selected types.");
    }
    return fail(error.message);
  }

  revalidatePath("/masters/accounts");
  invalidateMasterCache("accounts");
  return null;
}

export async function updateAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing account." };

  const parsed = parseAccountUpdate(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update(parsed.payload).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/masters/accounts");
  invalidateMasterCache("accounts");
  return null;
}

export async function createPaymentMode(_state: FormState, formData: FormData): Promise<FormState> {
  const mode = text(formData, "mode");
  if (!mode) return { error: "Enter a payment." };

  const supabase = await createClient();
  const { error } = await supabase.from("payment_modes").insert({ mode });
  if (error) return fail(error.message);

  revalidatePath("/masters/payment-modes");
  invalidateMasterCache("payment-modes");
  return null;
}

const TRANSACTION_TYPES = new Set(["in", "out", "both"]);
const COST_NATURES = new Set([
  "Direct",
  "Overhead",
  "Revenue",
  "Non-Cost",
]);
const DEFAULT_ALLOCATIONS = new Set(["company", "project"]);

function parseRoleIds(formData: FormData) {
  return [...new Set(formData.getAll("role_ids").map((value) => String(value).trim()).filter(Boolean))];
}

async function syncTransactionCategoryRoles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: number,
  roleIds: string[],
) {
  const { error: deleteError } = await supabase
    .from("transaction_category_roles")
    .delete()
    .eq("category_id", categoryId);
  if (deleteError) return deleteError.message;

  if (roleIds.length === 0) return null;

  const { error: insertError } = await supabase.from("transaction_category_roles").insert(
    roleIds.map((role_id) => ({
      category_id: categoryId,
      role_id,
    })),
  );
  return insertError?.message ?? null;
}

function parseTransactionCategory(formData: FormData):
  | { ok: false; error: string }
  | {
      ok: true;
      payload: {
        name: string;
        transaction_type: string;
        cost_nature: string;
        default_allocation: string;
        active: boolean;
      };
    } {
  const name = text(formData, "name");
  const transaction_type = text(formData, "transaction_type");
  const cost_nature = text(formData, "cost_nature");
  const default_allocation = text(formData, "default_allocation");

  if (!name) return { ok: false, error: "Enter a category name." };
  if (!TRANSACTION_TYPES.has(transaction_type)) {
    return { ok: false, error: "Choose a valid transaction type." };
  }
  if (!COST_NATURES.has(cost_nature)) return { ok: false, error: "Choose a valid cost nature." };
  if (!DEFAULT_ALLOCATIONS.has(default_allocation)) return { ok: false, error: "Choose a valid default allocation." };

  return {
    ok: true,
    payload: {
      name,
      transaction_type,
      cost_nature,
      default_allocation,
      active: true,
    },
  };
}

export async function createTransactionCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseTransactionCategory(formData);
  if (!parsed.ok) return { error: parsed.error };
  const roleIds = parseRoleIds(formData);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transaction_categories")
    .insert(parsed.payload)
    .select("id")
    .single();
  if (error) return fail(error.message);

  const roleError = await syncTransactionCategoryRoles(supabase, data.id, roleIds);
  if (roleError) return fail(roleError);

  revalidatePath("/masters/transactions");
  revalidatePath("/finance-manager");
  revalidatePath("/finance-executive");
  invalidateMasterCache("transactions");
  return null;
}

export async function updateTransactionCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing category." };

  const parsed = parseTransactionCategory(formData);
  if (!parsed.ok) return { error: parsed.error };

  const roleIds = parseRoleIds(formData);

  const supabase = await createClient();
  const { error } = await supabase.from("transaction_categories").update(parsed.payload).eq("id", id);
  if (error) return fail(error.message);

  const roleError = await syncTransactionCategoryRoles(supabase, id, roleIds);
  if (roleError) return fail(roleError);

  revalidatePath("/masters/transactions");
  revalidatePath("/finance-manager");
  revalidatePath("/finance-executive");
  invalidateMasterCache("transactions");
  return null;
}

export async function createVendor(_state: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  const contactNumber = text(formData, "contact_number");
  const vendorType = text(formData, "vendor_type");

  if (!name || !contactNumber || !vendorType) {
    return { error: "Enter the vendor name, contact number, and type." };
  }

  if (!isValidMobile(contactNumber)) {
    return { error: "Contact number must be a 10-digit number." };
  }

  if (vendorType !== "Supplier" && vendorType !== "Transporter") {
    return { error: "Vendor type must be Supplier or Transporter." };
  }

  const transporterScopeRaw = text(formData, "transporter_scope");
  let transporter_scope: TransporterScope | null = null;
  if (vendorType === "Transporter") {
    if (transporterScopeRaw !== "Local" && transporterScopeRaw !== "Non-Local") {
      return { error: "Choose Local or Non-Local for transporters." };
    }
    transporter_scope = transporterScopeRaw;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({
    name,
    contact_number: contactNumber,
    vendor_type: vendorType as VendorType,
    transporter_scope,
  });
  if (error) return fail(error.message);

  revalidatePath("/masters/vendors");
  invalidateMasterCache("vendors");
  return null;
}

export async function createFish(_state: FormState, formData: FormData): Promise<FormState> {
  const fishType = text(formData, "fish_type");
  const seedSize = text(formData, "seed_size");
  if (!fishType || !seedSize) return { error: "Enter the fish type and seed size." };

  const supabase = await createClient();
  const { error } = await supabase.from("fishes").insert({
    fish_type: fishType,
    seed_size: seedSize,
  });
  if (error) return fail(error.message);

  revalidatePath("/masters/fishes");
  invalidateMasterCache("fishes");
  return null;
}

export async function createDistrict(_state: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  if (!name) return { error: "Enter a district name." };

  const supabase = await createClient();
  const { error } = await supabase.from("districts").insert({ name });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { error: "That district already exists." };
    return fail(error.message);
  }

  revalidatePath("/masters/districts");
  invalidateMasterCache("districts");
  return null;
}

export async function addSociety(_state: FormState, formData: FormData): Promise<FormState> {
  const districtId = Number(formData.get("district_id"));
  const name = text(formData, "society_name");
  if (!districtId || !name) return { error: "Enter a society name." };

  const supabase = await createClient();
  const { error } = await supabase.from("societies").insert({
    district_id: districtId,
    name,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { error: "That society is already on this district." };
    }
    return fail(error.message);
  }

  revalidatePath("/masters/districts");
  invalidateMasterCache("districts");
  return null;
}

export async function tagCompany(_state: FormState, formData: FormData): Promise<FormState> {
  const districtId = Number(formData.get("district_id"));
  const companyName = text(formData, "company_name");
  if (!districtId || !companyName) return { error: "Enter a company name." };

  const company = await findOrCreateNamed("companies", companyName);
  if (company.error || !company.id) return fail(company.error ?? "Could not save the company.");

  const supabase = await createClient();
  const { error } = await supabase.from("district_companies").insert({
    district_id: districtId,
    company_id: company.id,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { error: "That company is already tagged to this district." };
    }
    return fail(error.message);
  }

  revalidatePath("/masters/districts");
  invalidateMasterCache("districts");
  return null;
}

async function removeRow(
  table:
    | "accounts"
    | "payment_modes"
    | "transaction_categories"
    | "vendors"
    | "fishes"
    | "districts"
    | "societies",
  id: number,
  path: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    redirect(`${path}?error=${encodeURIComponent(readableError(error.message))}`);
  }
  revalidatePath(path);
  const slug = path.split("/").filter(Boolean).pop();
  if (slug) invalidateMasterCache(slug);
}

export async function deleteAccount(formData: FormData) {
  await removeRow("accounts", Number(formData.get("id")), "/masters/accounts");
}

export async function deletePaymentMode(formData: FormData) {
  await removeRow("payment_modes", Number(formData.get("id")), "/masters/payment-modes");
}

export async function deleteTransactionCategory(formData: FormData) {
  await removeRow("transaction_categories", Number(formData.get("id")), "/masters/transactions");
}

export async function deleteVendor(formData: FormData) {
  await removeRow("vendors", Number(formData.get("id")), "/masters/vendors");
}

export async function deleteFish(formData: FormData) {
  await removeRow("fishes", Number(formData.get("id")), "/masters/fishes");
}

export async function deleteDistrict(formData: FormData) {
  await removeRow("districts", Number(formData.get("id")), "/masters/districts");
}

export async function deleteSociety(formData: FormData) {
  await removeRow("societies", Number(formData.get("id")), "/masters/districts");
}

export async function unlinkCompany(formData: FormData) {
  const districtId = Number(formData.get("district_id"));
  const companyId = Number(formData.get("company_id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("district_companies")
    .delete()
    .eq("district_id", districtId)
    .eq("company_id", companyId);

  if (error) {
    redirect(`/masters/districts?error=${encodeURIComponent(readableError(error.message))}`);
  }

  revalidatePath("/masters/districts");
  invalidateMasterCache("districts");
}
