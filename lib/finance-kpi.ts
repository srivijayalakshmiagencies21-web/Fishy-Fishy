import type { TransactionRow } from "@/lib/transactions";

export type FinanceKpiVariant = "cost-nature" | "executive";

export type CategoryMeta = {
  cost_nature: string;
  default_allocation: "company" | "project";
};

export type CostNatureKpiKey =
  | "revenue"
  | "overhead"
  | "non-cost"
  | "direct-journey"
  | "direct-company";

export type ExecutiveKpiKey = "inflows" | "outflows" | "available-balance";

export type FinanceKpiKey = CostNatureKpiKey | ExecutiveKpiKey;

export type FinanceKpiDefinition = {
  key: FinanceKpiKey;
  label: string;
  subtitle?: string;
  /** Balance is computed; split panel uses a summary layout. */
  splitMode?: "category" | "inflow-summary" | "balance-summary";
};

export const COST_NATURE_KPI_DEFINITIONS: FinanceKpiDefinition[] = [
  { key: "revenue", label: "Revenue" },
  { key: "overhead", label: "Overhead" },
  { key: "non-cost", label: "Non-Cost" },
  { key: "direct-journey", label: "Direct", subtitle: "Journey" },
  { key: "direct-company", label: "Direct", subtitle: "Company" },
];

export const EXECUTIVE_KPI_DEFINITIONS: FinanceKpiDefinition[] = [
  { key: "inflows", label: "Money In & Transferred", splitMode: "inflow-summary" },
  { key: "outflows", label: "Money Out" },
  { key: "available-balance", label: "Available balance", splitMode: "balance-summary" },
];

export function kpiDefinitionsForVariant(variant: FinanceKpiVariant): FinanceKpiDefinition[] {
  return variant === "executive" ? EXECUTIVE_KPI_DEFINITIONS : COST_NATURE_KPI_DEFINITIONS;
}

export type FinanceKpiWallet = {
  id: number;
  openingBalance: number;
};

function categoryMetaForRow(
  row: TransactionRow,
  metaByLowerName: Map<string, CategoryMeta>,
): CategoryMeta | null {
  const key = row.category.trim().toLowerCase();
  if (!key) return null;
  return metaByLowerName.get(key) ?? null;
}

function walletIdSet(wallets: FinanceKpiWallet[]): Set<number> {
  return new Set(wallets.map((w) => w.id));
}

function openingTotal(wallets: FinanceKpiWallet[]): number {
  return wallets.reduce((sum, w) => sum + w.openingBalance, 0);
}

function rowMatchesExecutiveMoneyIn(row: TransactionRow, wallets: Set<number>) {
  return row.type === "in" && wallets.has(row.account_id);
}

/** Transfer received into the executive wallet (destination account). */
function rowMatchesExecutiveTransferIn(row: TransactionRow, wallets: Set<number>) {
  return row.type === "transfer" && wallets.has(row.account_id);
}

function rowMatchesExecutiveMoneyOut(row: TransactionRow, wallets: Set<number>) {
  return row.type === "out" && wallets.has(row.account_id);
}

/** Transfer sent from the executive wallet (source account). */
function rowMatchesExecutiveTransferOut(row: TransactionRow, wallets: Set<number>) {
  return row.type === "transfer" && row.to_account_id != null && wallets.has(row.to_account_id);
}

function rowMatchesExecutiveInflows(row: TransactionRow, wallets: Set<number>) {
  return rowMatchesExecutiveMoneyIn(row, wallets) || rowMatchesExecutiveTransferIn(row, wallets);
}

function rowMatchesExecutiveOutflows(row: TransactionRow, wallets: Set<number>) {
  return rowMatchesExecutiveMoneyOut(row, wallets) || rowMatchesExecutiveTransferOut(row, wallets);
}

function applyWalletLedgerDelta(row: TransactionRow, wallets: Set<number>, delta: number) {
  if (row.type === "in" && wallets.has(row.account_id)) return delta + row.amount;
  if (row.type === "out" && wallets.has(row.account_id)) return delta - row.amount;
  if (row.type === "transfer") {
    if (row.to_account_id != null && wallets.has(row.to_account_id)) delta -= row.amount;
    if (wallets.has(row.account_id)) delta += row.amount;
  }
  return delta;
}

export function executiveWalletBalance(rows: TransactionRow[], wallets: FinanceKpiWallet[]): number {
  const ids = walletIdSet(wallets);
  if (ids.size === 0) return 0;
  let balance = openingTotal(wallets);
  for (const row of rows) {
    balance = applyWalletLedgerDelta(row, ids, balance);
  }
  return balance;
}

export function transactionMatchesKpi(
  row: TransactionRow,
  metaByLowerName: Map<string, CategoryMeta>,
  kpi: FinanceKpiKey,
  wallets: FinanceKpiWallet[],
): boolean {
  if (kpi === "inflows") return rowMatchesExecutiveInflows(row, walletIdSet(wallets));
  if (kpi === "outflows") return rowMatchesExecutiveOutflows(row, walletIdSet(wallets));
  if (kpi === "available-balance") return false;

  const meta = categoryMetaForRow(row, metaByLowerName);
  if (!meta) return false;

  switch (kpi) {
    case "revenue":
      return meta.cost_nature === "Revenue";
    case "overhead":
      return meta.cost_nature === "Overhead";
    case "non-cost":
      return meta.cost_nature === "Non-Cost";
    case "direct-journey":
      return meta.cost_nature === "Direct" && meta.default_allocation === "project";
    case "direct-company":
      return meta.cost_nature === "Direct" && meta.default_allocation === "company";
    default:
      return false;
  }
}

export function kpiTotalAmount(
  rows: TransactionRow[],
  metaByLowerName: Map<string, CategoryMeta>,
  kpi: FinanceKpiKey,
  wallets: FinanceKpiWallet[],
): number {
  if (kpi === "available-balance") return executiveWalletBalance(rows, wallets);

  let total = 0;
  for (const row of rows) {
    if (!transactionMatchesKpi(row, metaByLowerName, kpi, wallets)) continue;
    total += row.amount;
  }
  return total;
}

export type CategorySplitRow = {
  category: string;
  amount: number;
  count: number;
};

export function kpiCategorySplit(
  rows: TransactionRow[],
  metaByLowerName: Map<string, CategoryMeta>,
  kpi: FinanceKpiKey,
  wallets: FinanceKpiWallet[],
): CategorySplitRow[] {
  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const row of rows) {
    if (!transactionMatchesKpi(row, metaByLowerName, kpi, wallets)) continue;
    const name = row.category.trim() || "—";
    const prev = byCategory.get(name) ?? { amount: 0, count: 0 };
    byCategory.set(name, { amount: prev.amount + row.amount, count: prev.count + 1 });
  }
  return [...byCategory.entries()]
    .map(([category, stats]) => ({ category, ...stats }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export function executiveInflowSplit(rows: TransactionRow[], wallets: FinanceKpiWallet[]): CategorySplitRow[] {
  const ids = walletIdSet(wallets);
  let moneyIn = 0;
  let transferred = 0;
  let inCount = 0;
  let transferCount = 0;

  for (const row of rows) {
    if (rowMatchesExecutiveMoneyIn(row, ids)) {
      moneyIn += row.amount;
      inCount += 1;
    } else if (rowMatchesExecutiveTransferIn(row, ids)) {
      transferred += row.amount;
      transferCount += 1;
    }
  }

  const rowsOut: CategorySplitRow[] = [];
  if (inCount > 0) rowsOut.push({ category: "Money In", amount: moneyIn, count: inCount });
  if (transferCount > 0) rowsOut.push({ category: "Transferred", amount: transferred, count: transferCount });
  return rowsOut;
}

export function executiveBalanceSummarySplit(
  rows: TransactionRow[],
  wallets: FinanceKpiWallet[],
): CategorySplitRow[] {
  const ids = walletIdSet(wallets);
  let moneyIn = 0;
  let transferredIn = 0;
  let moneyOut = 0;
  let transferredOut = 0;
  let inCount = 0;
  let transferInCount = 0;
  let outCount = 0;
  let transferOutCount = 0;

  for (const row of rows) {
    if (rowMatchesExecutiveMoneyIn(row, ids)) {
      moneyIn += row.amount;
      inCount += 1;
    } else if (rowMatchesExecutiveTransferIn(row, ids)) {
      transferredIn += row.amount;
      transferInCount += 1;
    } else if (rowMatchesExecutiveMoneyOut(row, ids)) {
      moneyOut += row.amount;
      outCount += 1;
    } else if (rowMatchesExecutiveTransferOut(row, ids)) {
      transferredOut += row.amount;
      transferOutCount += 1;
    }
  }

  const opening = openingTotal(wallets);
  const inflows = moneyIn + transferredIn;
  const outflows = moneyOut + transferredOut;
  const rowsOut: CategorySplitRow[] = [];
  if (opening !== 0) rowsOut.push({ category: "Opening balance", amount: opening, count: wallets.length });
  if (inCount > 0) rowsOut.push({ category: "Money In", amount: moneyIn, count: inCount });
  if (transferInCount > 0) rowsOut.push({ category: "Transferred", amount: transferredIn, count: transferInCount });
  if (outCount > 0) rowsOut.push({ category: "Money Out", amount: moneyOut, count: outCount });
  if (transferOutCount > 0) {
    rowsOut.push({ category: "Transferred (out)", amount: transferredOut, count: transferOutCount });
  }
  return rowsOut;
}

export function buildCategoryMetaMap(entries: Record<string, CategoryMeta>): Map<string, CategoryMeta> {
  const map = new Map<string, CategoryMeta>();
  for (const [name, meta] of Object.entries(entries)) {
    map.set(name.trim().toLowerCase(), meta);
  }
  return map;
}
