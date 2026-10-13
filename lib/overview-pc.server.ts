import "server-only";

import { cache } from "react";
import type { FinancialYear } from "@/lib/financial-year";
import { financialYearIdForDate } from "@/lib/financial-year";
import {
  pcLedgerTransactionsForFinancialYear,
  type PcLedgerTransactionRow,
  type PcLedgerTxnInput,
} from "@/lib/overview-pc";
import { createClient } from "@/lib/supabase/server";

export const loadPcLedgerTransactionsForFinancialYear = cache(
  async function loadPcLedgerTransactionsForFinancialYear(
    year: FinancialYear | null,
    allYears: FinancialYear[],
    districtNameById: Record<number, string>,
  ): Promise<PcLedgerTransactionRow[]> {
    if (!year) return [];

    const supabase = await createClient();
    const [txnResult, districtsResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, amount, category, district_id, txn_date, party, type")
        .eq("type", "out")
        .order("txn_date", { ascending: false })
        .order("id", { ascending: false }),
      supabase.from("districts").select("id, name"),
    ]);

    if (txnResult.error) {
      console.error("[overview] load PC ledger failed:", txnResult.error.message);
      return [];
    }

    const names: Record<number, string> = { ...districtNameById };
    for (const row of districtsResult.data ?? []) {
      names[row.id] = row.name;
    }

    const txnRows: PcLedgerTxnInput[] = (txnResult.data ?? []).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category: row.category,
      district_id: row.district_id,
      txn_date: row.txn_date,
      party: row.party,
      type: row.type,
    }));

    return pcLedgerTransactionsForFinancialYear(
      txnRows,
      year.id,
      (isoDate) => financialYearIdForDate(allYears, isoDate),
      names,
    );
  },
);
