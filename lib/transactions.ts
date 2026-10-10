import type { TransactionCategoryRow } from "@/lib/masters";

export type TransactionAllocationFields = {
  showDistrict: boolean;
  showJourney: boolean;
  requireDistrict: boolean;
};

/** District / journey visibility from cost nature (parent) and default allocation (child). */
export function transactionAllocationFields(
  category: Pick<TransactionCategoryRow, "cost_nature" | "default_allocation"> | null | undefined,
): TransactionAllocationFields {
  if (!category) {
    return { showDistrict: false, showJourney: false, requireDistrict: false };
  }

  if (category.cost_nature === "Non-Cost" || category.cost_nature === "Overhead") {
    return { showDistrict: false, showJourney: false, requireDistrict: false };
  }

  if (category.default_allocation === "project") {
    return { showDistrict: true, showJourney: true, requireDistrict: true };
  }

  return { showDistrict: true, showJourney: false, requireDistrict: true };
}

export type TxnType = "in" | "out" | "transfer";

export type TxnEndpointMode = "account" | "party";

/** Which side of the form is account vs party for each transaction type. */
export function transactionEndpointMode(type: TxnType, side: "from" | "to"): TxnEndpointMode {
  if (type === "in") return side === "from" ? "party" : "account";
  if (type === "out") return side === "from" ? "account" : "party";
  return "account";
}

export type TransactionFormDbPayload = {
  account_id: number;
  to_account_id: number | null;
  party: string;
};

export function mapTransactionEndpointsToDb(
  type: TxnType,
  fromValue: string,
  toValue: string,
): TransactionFormDbPayload | { error: string } {
  const from = fromValue.trim();
  const to = toValue.trim();

  if (type === "in") {
    const account_id = Number(to);
    if (!from) return { error: "Enter a party on the from side." };
    if (!Number.isFinite(account_id) || account_id <= 0) return { error: "Choose an account on the to side." };
    return { account_id, to_account_id: null, party: from };
  }

  if (type === "out") {
    const account_id = Number(from);
    if (!Number.isFinite(account_id) || account_id <= 0) return { error: "Choose an account on the from side." };
    if (!to) return { error: "Enter a party on the to side." };
    return { account_id, to_account_id: null, party: to };
  }

  const account_id = Number(to);
  const to_account_id = Number(from);
  if (!Number.isFinite(to_account_id) || to_account_id <= 0) {
    return { error: "Choose the from account." };
  }
  if (!Number.isFinite(account_id) || account_id <= 0) {
    return { error: "Choose the to account." };
  }
  if (to_account_id === account_id) {
    return { error: "Transfer accounts must be different." };
  }
  return { account_id, to_account_id, party: "" };
}

export type TransactionAccountOption = {
  id: number;
  label: string;
  accountType: "account" | "wallet";
  /** Username or account name — used to auto-fill party on transfers. */
  partyLabel: string;
};

export function isCashPaymentMode(mode: string) {
  return mode.trim().toLowerCase() === "cash";
}

/** Fixed ledger category for account transfers (not configured in Masters). */
export const TRANSFER_CATEGORY_LABEL = "Transfer";

/** From/to cell values for the ledger (inverse of form endpoint mapping). */
export function transactionLedgerEndpoints(
  row: Pick<TransactionRow, "type" | "account_id" | "to_account_id" | "party">,
  accountName: (id: number) => string,
): { from: string; to: string } {
  if (row.type === "in") {
    return { from: row.party.trim() || "—", to: accountName(row.account_id) };
  }
  if (row.type === "out") {
    return { from: accountName(row.account_id), to: row.party.trim() || "—" };
  }
  return {
    from: row.to_account_id != null ? accountName(row.to_account_id) : "—",
    to: accountName(row.account_id),
  };
}

export type TransactionRow = {
  id: number;
  txn_date: string;
  type: TxnType;
  account_id: number;
  to_account_id: number | null;
  amount: number;
  category: string;
  payment_mode: string;
  party: string;
  remarks: string;
  journey_id: string | null;
  district_id: number | null;
  created_at: string;
};

export function transactionTouchesAccountIds(
  row: Pick<TransactionRow, "account_id" | "to_account_id">,
  accountIds: ReadonlySet<number>,
): boolean {
  if (accountIds.has(row.account_id)) return true;
  if (row.to_account_id != null && accountIds.has(row.to_account_id)) return true;
  return false;
}

export type JourneyPickRow = {
  id: string;
  /** Same sequential number as Start / Transfer / Overview (created_at order). */
  number: number;
  /** District ids from this journey’s trucks (district is stored per truck, not on journeys). */
  districtIds: number[];
};

export function journeyTruckDistrictIds(
  trucks: { district_id?: number | null }[] | null | undefined,
): number[] {
  const ids = new Set<number>();
  for (const truck of trucks ?? []) {
    const id = truck.district_id;
    if (typeof id === "number" && id > 0) ids.add(id);
  }
  return [...ids];
}

export function journeyNumberLabel(number: number) {
  return `Journey #${number}`;
}

export function txnTypeLabel(type: TxnType) {
  if (type === "in") return "Money In";
  if (type === "out") return "Money Out";
  return "Transfer";
}

const TXN_TYPE_ORDER: TxnType[] = ["out", "in", "transfer"];

/** Transaction types implied by active categories (Masters → Transactions setup). */
export function txnTypesForCategories(categories: TransactionCategoryRow[]): TxnType[] {
  const allowed = new Set<TxnType>();
  for (const cat of categories) {
    if (!cat.active) continue;
    if (cat.transaction_type === "both") allowed.add("transfer");
    else if (cat.transaction_type === "in") allowed.add("in");
    else if (cat.transaction_type === "out") allowed.add("out");
  }
  return TXN_TYPE_ORDER.filter((type) => allowed.has(type));
}

export function defaultTxnTypeForCategories(categories: TransactionCategoryRow[]): TxnType {
  return txnTypesForCategories(categories)[0] ?? "out";
}

export function txnTypeSelectOptions(types: TxnType[]) {
  return types.map((value) => ({ value, label: txnTypeLabel(value) }));
}

export function categoriesForType(categories: TransactionCategoryRow[], type: TxnType) {
  return categories.filter((cat) => {
    if (!cat.active) return false;
    if (type === "transfer") return cat.transaction_type === "both";
    return cat.transaction_type === type;
  });
}

/** Categories limited by transaction type and the signed-in user's role. */
export function categoryVisibleToUser(
  category: Pick<TransactionCategoryRow, "roleIds">,
  roleId: string | null,
  roleName: string,
) {
  if (roleName === "Admin") return true;
  if (category.roleIds.length === 0) return true;
  if (!roleId) return false;
  const needle = roleId.toLowerCase();
  return category.roleIds.some((id) => id.toLowerCase() === needle);
}

export function categoriesForUser(
  categories: TransactionCategoryRow[],
  type: TxnType,
  roleId: string | null,
  roleName: string,
) {
  return categoriesForType(categories, type).filter((cat) => categoryVisibleToUser(cat, roleId, roleName));
}

export function formatAmount(amount: number) {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
