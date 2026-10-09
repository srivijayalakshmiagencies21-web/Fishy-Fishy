import type { TransactionCategoryRow } from "@/lib/masters";

export type TxnType = "in" | "out" | "transfer";

/** Fixed ledger category for account transfers (not configured in Masters). */
export const TRANSFER_CATEGORY_LABEL = "Transfer";

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
  created_at: string;
};

export type JourneyPickRow = {
  id: string;
  /** Same sequential number as Start / Transfer / Overview (created_at order). */
  number: number;
  districtName: string;
};

export function journeyPickLabel(journey: Pick<JourneyPickRow, "number" | "districtName">) {
  return `Journey #${journey.number} (${journey.districtName})`;
}

export function journeyNumberLabel(number: number) {
  return `Journey #${number}`;
}

export function txnTypeLabel(type: TxnType) {
  if (type === "in") return "Money In";
  if (type === "out") return "Money Out";
  return "Transfer";
}

export function categoriesForType(categories: TransactionCategoryRow[], type: TxnType) {
  return categories.filter((cat) => {
    if (!cat.active) return false;
    if (type === "transfer") return cat.transaction_type === "both";
    return cat.transaction_type === type;
  });
}

export function formatAmount(amount: number) {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
