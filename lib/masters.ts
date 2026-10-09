import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NamedRow = {
  id: number;
  label: string;
};

export type VendorRow = {
  id: number;
  name: string;
  contactNumber: string;
  vendorType: string;
};

export type FishRow = {
  id: number;
  fishType: string;
  seedSize: string;
};

export type DistrictRow = {
  id: number;
  name: string;
  societies: NamedRow[];
  companies: NamedRow[];
};

export type TransactionCategoryRow = {
  id: number;
  name: string;
  transaction_type: "in" | "out" | "both";
  cost_nature: string;
  default_allocation: "company" | "ask" | "project";
  active: boolean;
};

export type MasterData =
  | { kind: "accounts" | "payment-modes"; rows: NamedRow[]; error: string | null }
  | { kind: "transactions"; rows: TransactionCategoryRow[]; error: string | null }
  | { kind: "vendors"; rows: VendorRow[]; error: string | null }
  | { kind: "fishes"; rows: FishRow[]; error: string | null }
  | { kind: "districts"; rows: DistrictRow[]; error: string | null };

export function readableError(message: string) {
  if (/relation .* does not exist|schema cache|could not find the table/i.test(message)) {
    return "These tables are not on the Supabase project yet. The SQL is in supabase/migrations and has not been applied.";
  }

  if (/row-level security|permission denied|42501/i.test(message)) {
    return "This role cannot change masters.";
  }

  return message;
}

export async function loadMaster(slug: string): Promise<MasterData> {
  const supabase = await createClient();
  return loadMasterWithClient(supabase, slug);
}

export async function loadMasterWithClient(supabase: SupabaseServerClient, slug: string): Promise<MasterData> {
  if (slug === "accounts") {
    const { data, error } = await supabase.from("accounts").select("id, name").order("name");
    return {
      kind: "accounts",
      rows: (data ?? []).map((row) => ({ id: row.id, label: row.name })),
      error: error ? readableError(error.message) : null,
    };
  }

  if (slug === "payment-modes") {
    const { data, error } = await supabase.from("payment_modes").select("id, mode").order("mode");
    return {
      kind: "payment-modes",
      rows: (data ?? []).map((row) => ({ id: row.id, label: row.mode })),
      error: error ? readableError(error.message) : null,
    };
  }

  if (slug === "transactions") {
    const { data, error } = await supabase
      .from("transaction_categories")
      .select("id, name, transaction_type, cost_nature, default_allocation, active")
      .order("name");
    return {
      kind: "transactions",
      rows: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        transaction_type: row.transaction_type as TransactionCategoryRow["transaction_type"],
        cost_nature: row.cost_nature,
        default_allocation: row.default_allocation as TransactionCategoryRow["default_allocation"],
        active: row.active,
      })),
      error: error ? readableError(error.message) : null,
    };
  }

  if (slug === "vendors") {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, contact_number, vendor_type")
      .order("name");
    return {
      kind: "vendors",
      rows: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        contactNumber: row.contact_number,
        vendorType: row.vendor_type,
      })),
      error: error ? readableError(error.message) : null,
    };
  }

  if (slug === "fishes") {
    const { data, error } = await supabase
      .from("fishes")
      .select("id, fish_type, seed_size")
      .order("fish_type");
    return {
      kind: "fishes",
      rows: (data ?? []).map((row) => ({
        id: row.id,
        fishType: row.fish_type,
        seedSize: row.seed_size,
      })),
      error: error ? readableError(error.message) : null,
    };
  }

  const { data, error } = await supabase
    .from("districts")
    .select("id, name, societies(id, name), district_companies(company_id, companies(id, name))")
    .order("name");

  return {
    kind: "districts",
    rows: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      societies: (row.societies ?? [])
        .map((society) => ({ id: society.id, label: society.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      companies: (row.district_companies ?? [])
        .flatMap((link) => {
          const company = link.companies;
          return company ? [{ id: company.id, label: company.name }] : [];
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    })),
    error: error ? readableError(error.message) : null,
  };
}
