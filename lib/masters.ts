import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";

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
  transporterScope: string | null;
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

export type AccountType = "account" | "wallet";

export type AccountRow = {
  id: number;
  name: string;
  accountType: AccountType;
  linkedUserId: string | null;
  linkedUsername: string | null;
  openingBalance: number;
  openingBalanceDate: string;
};

export type LinkUserOption = {
  id: string;
  username: string;
};

export type RoleOption = {
  id: string;
  name: string;
};

export type TransactionCategoryRow = {
  id: number;
  name: string;
  transaction_type: "in" | "out" | "both";
  cost_nature: string;
  default_allocation: "company" | "project";
  active: boolean;
  /** Empty = visible to every role in Finance. */
  roleIds: string[];
};

export type MasterData =
  | { kind: "accounts"; rows: AccountRow[]; users: LinkUserOption[]; error: string | null }
  | { kind: "payment-modes"; rows: NamedRow[]; error: string | null }
  | { kind: "transactions"; rows: TransactionCategoryRow[]; roles: RoleOption[]; error: string | null }
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

function usernameFromEmail(email: string | null | undefined) {
  if (!email) return "";
  return email.split("@")[0]?.trim() ?? "";
}

export async function loadAccountLinkUsers(
  supabase: SupabaseServerClient,
): Promise<{ users: LinkUserOption[]; userLoadError: string | null }> {
  const linkResult = await supabase.rpc("list_account_link_users");
  if (!linkResult.error && (linkResult.data?.length ?? 0) > 0) {
    return {
      users: (linkResult.data ?? []).map((row) => ({
        id: row.user_id,
        username: row.username,
      })),
      userLoadError: null,
    };
  }

  const session = await getSessionUser();
  const canUseDirectory =
    session?.role === "Admin" ||
    session?.role === "Manager" ||
    session?.pages.includes("users") === true;

  if (canUseDirectory) {
    const directoryResult = await supabase.rpc("list_app_users");
    if (!directoryResult.error) {
      const users = (directoryResult.data ?? [])
        .map((row) => ({
          id: row.user_id,
          username: usernameFromEmail(row.email),
        }))
        .filter((row) => row.username.length > 0);
      if (users.length > 0) {
        return { users, userLoadError: null };
      }
    }
  }

  if (linkResult.error) {
    const message = linkResult.error.message;
    if (/could not find the function|schema cache/i.test(message)) {
      return {
        users: [],
        userLoadError:
          "User list is unavailable until database migration 20261010130000_account_type_and_link.sql is applied (run db:push).",
      };
    }
    if (/not allowed/i.test(message)) {
      return { users: [], userLoadError: null };
    }
    return { users: [], userLoadError: readableError(message) };
  }

  return { users: [], userLoadError: null };
}

export async function loadMasterWithClient(supabase: SupabaseServerClient, slug: string): Promise<MasterData> {
  if (slug === "accounts") {
    const [accountsResult, linkUsers] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, account_type, linked_user_id, opening_balance, opening_balance_date")
        .order("name"),
      loadAccountLinkUsers(supabase),
    ]);
    const users = linkUsers.users;
    const usernameById = new Map(users.map((user) => [user.id, user.username]));
    const error =
      accountsResult.error?.message ??
      linkUsers.userLoadError ??
      null;
    return {
      kind: "accounts",
      rows: (accountsResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        accountType: row.account_type === "wallet" ? "wallet" : "account",
        linkedUserId: row.linked_user_id,
        linkedUsername: row.linked_user_id ? (usernameById.get(row.linked_user_id) ?? null) : null,
        openingBalance: Number(row.opening_balance) || 0,
        openingBalanceDate: row.opening_balance_date ?? "",
      })),
      users,
      error: error ? readableError(error) : null,
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
    const [categoriesResult, rolesResult, linksResult] = await Promise.all([
      supabase
        .from("transaction_categories")
        .select("id, name, transaction_type, cost_nature, default_allocation, active")
        .order("name"),
      supabase.from("roles").select("id, name").order("name"),
      supabase.from("transaction_category_roles").select("category_id, role_id"),
    ]);
    const linksError = linksResult.error?.message ?? null;
    const linksMissing =
      linksError && /does not exist|schema cache|could not find the table/i.test(linksError);
    const error =
      categoriesResult.error?.message ??
      rolesResult.error?.message ??
      (linksError && !linksMissing ? linksError : null) ??
      null;
    const roleIdsByCategory = new Map<number, string[]>();
    for (const link of linksResult.data ?? []) {
      const list = roleIdsByCategory.get(link.category_id) ?? [];
      list.push(link.role_id);
      roleIdsByCategory.set(link.category_id, list);
    }
    return {
      kind: "transactions",
      rows: (categoriesResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        transaction_type: row.transaction_type as TransactionCategoryRow["transaction_type"],
        cost_nature: row.cost_nature,
        default_allocation: row.default_allocation as TransactionCategoryRow["default_allocation"],
        active: row.active,
        roleIds: roleIdsByCategory.get(row.id) ?? [],
      })),
      roles: (rolesResult.data ?? []).map((row) => ({ id: row.id, name: row.name })),
      error: error ? readableError(error) : null,
    };
  }

  if (slug === "vendors") {
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, contact_number, vendor_type, transporter_scope")
      .order("name");
    return {
      kind: "vendors",
      rows: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        contactNumber: row.contact_number,
        vendorType: row.vendor_type,
        transporterScope: row.transporter_scope,
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
