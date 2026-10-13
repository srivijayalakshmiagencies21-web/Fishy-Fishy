import { normalizeTransactionCategoryKey } from "@/lib/finance-party-vendors";

export type ExpensesLedgerTransactionRow = {
  id: number;
  category: string;
  txnDate: string;
  party: string;
  amount: number;
};

export type ExpensesCategorySummaryRow = {
  category: string;
  amount: number;
};

/** Money Out categories shown on other Overview KPI ledgers — excluded from Expenses. */
const OVERVIEW_EXPENSES_EXCLUDED_KEYS = new Set([
  "pc",
  "pg deposit",
  "pg refund",
  "pg deposit refund",
  "seed vendor",
  "transport local vendor",
  "transport non local vendor",
]);

export function isOverviewExpensesCategory(category: string) {
  const key = normalizeTransactionCategoryKey(category);
  return !OVERVIEW_EXPENSES_EXCLUDED_KEYS.has(key);
}

export function overviewExpenseCategoryNames(
  categories: Array<{ name: string; transaction_type: string }>,
): string[] {
  return categories
    .filter((row) => row.transaction_type === "out" && isOverviewExpensesCategory(row.name))
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b));
}

export type ExpensesLedgerTxnInput = {
  id: number;
  amount: number;
  category: string;
  txn_date: string;
  party: string;
  type: string;
};

export function expensesLedgerTransactionsForFinancialYear(
  rows: ExpensesLedgerTxnInput[],
  yearId: number,
  financialYearIdForTxnDate: (isoDate: string) => number | null,
): ExpensesLedgerTransactionRow[] {
  const lines: ExpensesLedgerTransactionRow[] = [];

  for (const row of rows) {
    if (row.type !== "out") continue;
    const category = row.category?.trim();
    if (!category || !isOverviewExpensesCategory(category)) continue;
    if (financialYearIdForTxnDate(row.txn_date) !== yearId) continue;

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    lines.push({
      id: row.id,
      category,
      txnDate: row.txn_date,
      party: row.party?.trim() || "—",
      amount,
    });
  }

  return lines.sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category);
    if (byCategory !== 0) return byCategory;
    return b.txnDate.localeCompare(a.txnDate);
  });
}

export function expensesCategorySummaries(
  lines: ExpensesLedgerTransactionRow[],
  categoryNames: string[] = [],
): ExpensesCategorySummaryRow[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.category, (totals.get(line.category) ?? 0) + line.amount);
  }

  if (categoryNames.length > 0) {
    const rows: ExpensesCategorySummaryRow[] = categoryNames.map((category) => ({
      category,
      amount: totals.get(category) ?? 0,
    }));
    const known = new Set(categoryNames);
    for (const [category, amount] of totals) {
      if (known.has(category) || amount <= 0) continue;
      rows.push({ category, amount });
    }
    return rows.sort((a, b) => a.category.localeCompare(b.category));
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function sumExpensesAmount(
  lines: ExpensesLedgerTransactionRow[] | ExpensesCategorySummaryRow[],
) {
  return lines.reduce((sum, row) => sum + row.amount, 0);
}
