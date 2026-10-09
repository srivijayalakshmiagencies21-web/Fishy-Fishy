"use server";

import { revalidatePath } from "next/cache";
import { invalidateMasterCache } from "@/lib/cache-tags.server";
import { loadMasterCached } from "@/lib/cached-masters.server";
import { redirect } from "next/navigation";
import type { VendorType } from "@/supabase/database.types";
import { getMasterLink } from "@/lib/master-links";
import { readableError, type MasterData } from "@/lib/masters";
import { createClient } from "@/lib/supabase/server";
import { isValidMobile } from "@/lib/phone";

export type FormState = { error: string } | null;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fail(message: string): FormState {
  return { error: readableError(message) };
}

export async function fetchMaster(slug: string): Promise<MasterData> {
  if (!getMasterLink(slug)) {
    return { kind: "accounts", rows: [], error: "Unknown master." };
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

export async function createAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  if (!name) return { error: "Enter an account name." };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({ name });
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
const DEFAULT_ALLOCATIONS = new Set(["company", "ask", "project"]);

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

  const supabase = await createClient();
  const { error } = await supabase.from("transaction_categories").insert(parsed.payload);
  if (error) return fail(error.message);

  revalidatePath("/masters/transactions");
  invalidateMasterCache("transactions");
  return null;
}

export async function updateTransactionCategory(_state: FormState, formData: FormData): Promise<FormState> {
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing category." };

  const parsed = parseTransactionCategory(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("transaction_categories").update(parsed.payload).eq("id", id);
  if (error) return fail(error.message);

  revalidatePath("/masters/transactions");
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

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").insert({
    name,
    contact_number: contactNumber,
    vendor_type: vendorType as VendorType,
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
