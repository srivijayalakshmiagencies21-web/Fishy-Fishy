import "server-only";

import { loadAccountLinkUsers, type NamedRow, type TransactionCategoryRow } from "@/lib/masters";
import {
  categoryVisibleToUser,
  journeyTruckDistrictIds,
  transactionTouchesAccountIds,
  type JourneyPickRow,
  type TransactionAccountOption,
  type TransactionRow,
  type TxnType,
} from "@/lib/transactions";
import type { CategoryMeta, FinanceKpiVariant, FinanceKpiWallet } from "@/lib/finance-kpi";
import { fetchFinancialYears } from "@/lib/financial-year.server";
import type { FinancialYear } from "@/lib/financial-year";
import type { PartyVendorRecord } from "@/lib/finance-party-vendors";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { noSkipCache, workspaceCache, type ServerSupabase, type SkipCache } from "@/lib/workspace-cache.server";

/** Manager Finance: all active categories. Executive Finance: Masters role links. */
export type FinanceCategoryScope = "full" | "role";

function accountLedgerLabel(name: string, accountType: string) {
  if (accountType === "wallet") return `${name} (Wallet)`;
  if (accountType === "account") return `${name} (Account)`;
  return name;
}

export type TransactionsPageData = {
  rows: TransactionRow[];
  accounts: TransactionAccountOption[];
  /** Ledger-only labels for accounts not in `accounts` (e.g. transfer counterparty on Executive Finance). */
  ledgerAccountLabelById: Record<number, string>;
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  journeys: JourneyPickRow[];
  districts: NamedRow[];
  partyVendors: string[];
  partyVendorRecords: PartyVendorRecord[];
  partySocieties: string[];
  categoryMetaByName: Record<string, CategoryMeta>;
  financeKpiVariant: FinanceKpiVariant;
  financeKpiWallets: FinanceKpiWallet[];
  financialYears: FinancialYear[];
  districtIdsByFinancialYear: Record<number, number[]>;
  error: string | null;
};

export async function loadFinanceCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: FinanceCategoryScope = "role",
  roleName?: string,
): Promise<TransactionCategoryRow[]> {
  if (scope === "full") {
    const categoriesResult = await supabase
      .from("transaction_categories")
      .select("id, name, transaction_type, cost_nature, default_allocation, active")
      .eq("active", true)
      .order("name");
    if (categoriesResult.error) throw new Error(categoriesResult.error.message);
    return (categoriesResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      transaction_type: row.transaction_type as TransactionCategoryRow["transaction_type"],
      cost_nature: row.cost_nature,
      default_allocation: row.default_allocation as TransactionCategoryRow["default_allocation"],
      active: row.active,
      roleIds: [],
    }));
  }

  const rpcResult = await supabase.rpc("finance_categories_for_me");
  if (!rpcResult.error && rpcResult.data) {
    return (rpcResult.data as Array<{
      id: number;
      name: string;
      transaction_type: string;
      cost_nature: string;
      default_allocation: string;
      active: boolean;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      transaction_type: row.transaction_type as TransactionCategoryRow["transaction_type"],
      cost_nature: row.cost_nature,
      default_allocation: row.default_allocation as TransactionCategoryRow["default_allocation"],
      active: row.active,
      roleIds: [],
    }));
  }

  if (rpcResult.error && !/does not exist|schema cache|could not find the function/i.test(rpcResult.error.message)) {
    throw new Error(rpcResult.error.message);
  }

  const [categoriesResult, linksResult] = await Promise.all([
    supabase
      .from("transaction_categories")
      .select("id, name, transaction_type, cost_nature, default_allocation, active")
      .order("name"),
    supabase.from("transaction_category_roles").select("category_id, role_id"),
  ]);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);

  const roleIdsByCategory = new Map<number, string[]>();
  for (const link of linksResult.data ?? []) {
    const list = roleIdsByCategory.get(link.category_id) ?? [];
    list.push(link.role_id);
    roleIdsByCategory.set(link.category_id, list);
  }

  const resolvedRoleName = roleName ?? (await getSessionUser())?.role ?? "";
  const roleIdResult = await supabase.rpc("get_my_role_id");
  const roleId = roleIdResult.data ?? null;

  return (categoriesResult.data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      transaction_type: row.transaction_type as TransactionCategoryRow["transaction_type"],
      cost_nature: row.cost_nature,
      default_allocation: row.default_allocation as TransactionCategoryRow["default_allocation"],
      active: row.active,
      roleIds: roleIdsByCategory.get(row.id) ?? [],
    }))
    .filter((row) => categoryVisibleToUser(row, roleId, resolvedRoleName));
}

export async function loadTransactionsPageData(kpiVariant: FinanceKpiVariant): Promise<TransactionsPageData> {
  const session = await getSessionUser();
  if (!session) {
    return fetchTransactionsPageData(await createClient(), noSkipCache, kpiVariant, null);
  }
  return workspaceCache(`finance:${kpiVariant}`, session.id, (supabase, skipCache) =>
    fetchTransactionsPageData(supabase, skipCache, kpiVariant, session),
  );
}

async function fetchTransactionsPageData(
  supabase: ServerSupabase,
  skipCache: SkipCache,
  kpiVariant: FinanceKpiVariant,
  session: SessionUser | null,
): Promise<TransactionsPageData> {
  const categoryScope: FinanceCategoryScope = kpiVariant === "executive" ? "role" : "full";

  const [
    txnResult,
    accountsResult,
    modesResult,
    categoriesResult,
    journeysResult,
    districtsResult,
    societiesResult,
    vendorsResult,
    linkUsersResult,
    allCategoriesMetaResult,
    financialYears,
    fyDistrictsResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, txn_date, type, account_id, to_account_id, amount, category, payment_mode, party, remarks, journey_id, district_id, created_at",
      )
      .order("txn_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("accounts")
      .select("id, name, account_type, linked_user_id, opening_balance")
      .order("name")
      .order("account_type"),
    supabase.from("payment_modes").select("id, mode").order("mode"),
    loadFinanceCategories(supabase, categoryScope, session?.role ?? ""),
    supabase
      .from("journeys")
      .select(
        `
        id,
        trucks:journey_trucks(
          district_id
        )
      `,
      )
      .order("created_at", { ascending: true })
      .limit(500),
    supabase.from("districts").select("id, name").order("name"),
    supabase.from("societies").select("name").order("name"),
    supabase.from("vendors").select("name, vendor_type, transporter_scope").order("name"),
    loadAccountLinkUsers(supabase, session),
    supabase.from("transaction_categories").select("name, cost_nature, default_allocation"),
    fetchFinancialYears(supabase, skipCache),
    supabase.from("financial_year_districts").select("financial_year_id, district_id"),
  ]);

  let categories: TransactionCategoryRow[] = [];
  let categoriesError: string | null = null;
  if (categoriesResult instanceof Error) {
    categoriesError = categoriesResult.message;
  } else {
    categories = categoriesResult;
  }

  const error =
    txnResult.error?.message ??
    accountsResult.error?.message ??
    modesResult.error?.message ??
    categoriesError ??
    journeysResult.error?.message ??
    districtsResult.error?.message ??
    societiesResult.error?.message ??
    vendorsResult.error?.message ??
    linkUsersResult.userLoadError ??
    allCategoriesMetaResult.error?.message ??
    fyDistrictsResult.error?.message ??
    null;
  if (error) skipCache();

  const categoryMetaByName: Record<string, CategoryMeta> = {};
  for (const row of allCategoriesMetaResult.data ?? []) {
    const allocation = row.default_allocation === "project" ? "project" : "company";
    categoryMetaByName[row.name] = {
      cost_nature: row.cost_nature,
      default_allocation: allocation,
    };
  }

  const usernameById = new Map(linkUsersResult.users.map((user) => [user.id, user.username]));
  const executiveLinkedAccounts =
    kpiVariant === "executive" && session?.id
      ? (accountsResult.data ?? []).filter((row) => row.linked_user_id === session.id)
      : [];

  const linkedAccountIdSet = new Set(executiveLinkedAccounts.map((row) => row.id));

  const financeKpiWallets: FinanceKpiWallet[] = executiveLinkedAccounts.map((row) => ({
    id: row.id,
    openingBalance: Number(row.opening_balance) || 0,
  }));

  const accountRowsForPage =
    kpiVariant === "executive" ? executiveLinkedAccounts : (accountsResult.data ?? []);

  const txnRows = (txnResult.data ?? []).filter(
    (row) => kpiVariant !== "executive" || transactionTouchesAccountIds(row, linkedAccountIdSet),
  );

  const ledgerAccountLabelById: Record<number, string> = {};
  if (kpiVariant === "executive" && txnRows.length > 0) {
    const knownIds = new Set(accountRowsForPage.map((row) => row.id));
    const counterpartyIds = new Set<number>();
    for (const row of txnRows) {
      if (!knownIds.has(row.account_id)) counterpartyIds.add(row.account_id);
      if (row.to_account_id != null && !knownIds.has(row.to_account_id)) {
        counterpartyIds.add(row.to_account_id);
      }
    }
    for (const row of accountsResult.data ?? []) {
      if (counterpartyIds.has(row.id)) {
        ledgerAccountLabelById[row.id] = accountLedgerLabel(row.name, row.account_type);
      }
    }
  }

  return {
    rows: txnRows.map((row) => ({
      id: row.id,
      txn_date: row.txn_date,
      type: row.type as TxnType,
      account_id: row.account_id,
      to_account_id: row.to_account_id,
      amount: Number(row.amount),
      category: row.category,
      payment_mode: row.payment_mode,
      party: row.party,
      remarks: row.remarks,
      journey_id: row.journey_id,
      district_id: row.district_id,
      created_at: row.created_at,
    })),
    districts: (districtsResult.data ?? []).map((row) => ({ id: row.id, label: row.name })),
    accounts: accountRowsForPage.map((row) => {
      const accountType = row.account_type === "wallet" ? "wallet" : "account";
      const linkedUsername = row.linked_user_id ? usernameById.get(row.linked_user_id) : undefined;
      const partyLabel = linkedUsername?.trim() || row.name.trim();
      return {
        id: row.id,
        accountType,
        partyLabel,
        label: accountLedgerLabel(row.name, row.account_type),
      };
    }),
    ledgerAccountLabelById,
    paymentModes: (modesResult.data ?? []).map((row) => ({ id: row.id, label: row.mode })),
    categories,
    journeys: (journeysResult.data ?? []).map((row, idx) => {
      const trucks = (row as { trucks?: { district_id?: number | null }[] }).trucks;
      return {
        id: row.id,
        number: idx + 1,
        districtIds: journeyTruckDistrictIds(trucks),
      };
    }),
    partyVendorRecords: (vendorsResult.data ?? []).map((row) => ({
      name: row.name,
      vendorType: row.vendor_type,
      transporterScope: row.transporter_scope,
    })),
    partyVendors: (vendorsResult.data ?? []).map((row) => row.name).filter(Boolean),
    partySocieties: (societiesResult.data ?? []).map((row) => row.name).filter(Boolean),
    categoryMetaByName,
    financeKpiVariant: kpiVariant,
    financeKpiWallets,
    financialYears,
    districtIdsByFinancialYear: buildDistrictIdsByFinancialYear(fyDistrictsResult.data),
    error,
  };
}

function buildDistrictIdsByFinancialYear(
  rows: { financial_year_id: number; district_id: number }[] | null | undefined,
): Record<number, number[]> {
  const map: Record<number, number[]> = {};
  for (const row of rows ?? []) {
    const fyId = row.financial_year_id;
    const districtId = row.district_id;
    if (!fyId || !districtId) continue;
    const list = map[fyId] ?? [];
    list.push(districtId);
    map[fyId] = list;
  }
  return map;
}
