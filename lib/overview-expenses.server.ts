import "server-only";

import { cache } from "react";
import type { FinancialYear } from "@/lib/financial-year";
import { financialYearIdForDate } from "@/lib/financial-year";
import {
  expensesLedgerTransactionsForFinancialYear,
  overviewExpenseCategoryNames,
  type ExpensesLedgerTransactionRow,
  type ExpensesLedgerTxnInput,
} from "@/lib/overview-expenses";
import { createClient } from "@/lib/supabase/server";

export type ExpensesLedgerData = {
  transactions: ExpensesLedgerTransactionRow[];
  categoryNames: string[];
};

export const loadExpensesLedgerForFinancialYear = cache(async function loadExpensesLedgerForFinancialYear(
  year: FinancialYear | null,
  allYears: FinancialYear[],
): Promise<ExpensesLedgerData> {
  const empty: ExpensesLedgerData = { transactions: [], categoryNames: [] };
  if (!year) return empty;

  const supabase = await createClient();
  const [txnResult, categoriesResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, category, txn_date, party, type")
      .eq("type", "out")
      .order("txn_date", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("transaction_categories")
      .select("name, transaction_type")
      .eq("active", true)
      .order("name"),
  ]);

  if (txnResult.error) {
    console.error("[overview] load expenses ledger failed:", txnResult.error.message);
    return empty;
  }
  if (categoriesResult.error) {
    console.error("[overview] load expense categories failed:", categoriesResult.error.message);
  }

  const categoryNames = overviewExpenseCategoryNames(categoriesResult.data ?? []);

  const txnRows: ExpensesLedgerTxnInput[] = (txnResult.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    txn_date: row.txn_date,
    party: row.party,
    type: row.type,
  }));

  const transactions = expensesLedgerTransactionsForFinancialYear(txnRows, year.id, (isoDate) =>
    financialYearIdForDate(allYears, isoDate),
  );

  return { transactions, categoryNames };
});
