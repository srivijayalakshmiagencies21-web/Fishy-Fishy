"use server";

import { revalidatePath } from "next/cache";
import { invalidateMasterCache } from "@/lib/cache-tags.server";
import { loadMasterCached } from "@/lib/cached-masters.server";
import { redirect } from "next/navigation";
import type { VendorType } from "@/supabase/database.types";
import { getMasterLink } from "@/lib/master-links";
import { readableError, type MasterData } from "@/lib/masters";
import { createClient } from "@/lib/supabase/server";

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

export async function createExpense(_state: FormState, formData: FormData): Promise<FormState> {
  const towards = text(formData, "towards");
  if (!towards) return { error: "Enter what the expense is towards." };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({ towards });
  if (error) return fail(error.message);

  revalidatePath("/masters/expenses");
  invalidateMasterCache("expenses");
  return null;
}

export async function createVendor(_state: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  const contactNumber = text(formData, "contact_number");
  const vendorType = text(formData, "vendor_type");

  if (!name || !contactNumber || !vendorType) {
    return { error: "Enter the vendor name, contact number, and type." };
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
  table: "accounts" | "payment_modes" | "expenses" | "vendors" | "fishes" | "districts" | "societies",
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

export async function deleteExpense(formData: FormData) {
  await removeRow("expenses", Number(formData.get("id")), "/masters/expenses");
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
