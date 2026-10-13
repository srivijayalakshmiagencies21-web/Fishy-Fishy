import "server-only";

import { cache } from "react";
import type { FinancialYear } from "@/lib/financial-year";
import { financialYearIdForDate } from "@/lib/financial-year";
import {
  aggregateVendorPaidFromTransactions,
  type VendorPaidTxnRow,
} from "@/lib/overview-vendor-paid";
import { createClient } from "@/lib/supabase/server";

export const loadVendorPaidTotalsForFinancialYear = cache(async function loadVendorPaidTotalsForFinancialYear(
  year: FinancialYear | null,
  allYears: FinancialYear[],
) {
  if (!year) return { seedByKey: {}, transportByKey: {} };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("amount, category, party, txn_date, type")
    .eq("type", "out");

  if (error) {
    console.error("[overview] load vendor paid failed:", error.message);
    return { seedByKey: {}, transportByKey: {} };
  }

  const txnRows: VendorPaidTxnRow[] = (data ?? []).map((row) => ({
    amount: Number(row.amount),
    category: row.category,
    party: row.party,
    txn_date: row.txn_date,
    type: row.type,
  }));

  return aggregateVendorPaidFromTransactions(txnRows, year.id, (isoDate) =>
    financialYearIdForDate(allYears, isoDate),
  );
});
