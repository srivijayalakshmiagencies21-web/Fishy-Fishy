import "server-only";

import type { NamedRow, TransactionCategoryRow } from "@/lib/masters";
import type { JourneyPickRow, TransactionRow, TxnType } from "@/lib/transactions";
import { createClient } from "@/lib/supabase/server";

export type TransactionsPageData = {
  rows: TransactionRow[];
  accounts: NamedRow[];
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  journeys: JourneyPickRow[];
  error: string | null;
};

export async function loadTransactionsPageData(): Promise<TransactionsPageData> {
  const supabase = await createClient();

  const [txnResult, accountsResult, modesResult, categoriesResult, journeysResult] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, txn_date, type, account_id, to_account_id, amount, category, payment_mode, party, remarks, journey_id, created_at",
      )
      .order("txn_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase.from("accounts").select("id, name").order("name"),
    supabase.from("payment_modes").select("id, mode").order("mode"),
    supabase
      .from("transaction_categories")
      .select("id, name, transaction_type, cost_nature, default_allocation, active")
      .order("name"),
    supabase
      .from("journeys")
      .select(
        `
        id,
        trucks:journey_trucks(
          created_at,
          district:district_id(name)
        )
      `,
      )
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  const error =
    txnResult.error?.message ??
    accountsResult.error?.message ??
    modesResult.error?.message ??
    categoriesResult.error?.message ??
    journeysResult.error?.message ??
    null;

  return {
    rows: (txnResult.data ?? []).map((row) => ({
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
      created_at: row.created_at,
    })),
    accounts: (accountsResult.data ?? []).map((row) => ({ id: row.id, label: row.name })),
    paymentModes: (modesResult.data ?? []).map((row) => ({ id: row.id, label: row.mode })),
    categories: (categoriesResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      transaction_type: row.transaction_type as TransactionCategoryRow["transaction_type"],
      cost_nature: row.cost_nature,
      default_allocation: row.default_allocation as TransactionCategoryRow["default_allocation"],
      active: row.active,
    })),
    journeys: (journeysResult.data ?? []).map((row, idx) => {
      const trucks = [
        ...((
          row as unknown as {
            trucks?: { created_at?: string; district?: { name?: string } | null }[];
          }
        ).trucks ?? []),
      ].sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      );
      const districtName =
        trucks.map((t) => t.district?.name?.trim()).find(Boolean) ?? "Unknown";
      return {
        id: row.id,
        number: idx + 1,
        districtName,
      };
    }),
    error,
  };
}
