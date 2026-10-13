import { normalizeTransactionCategoryKey } from "@/lib/finance-party-vendors";

export type PcLedgerTransactionRow = {
  id: number;
  districtId: number;
  districtName: string;
  txnDate: string;
  party: string;
  amount: number;
};

export type PcDistrictSummaryRow = {
  districtId: number;
  districtName: string;
  amount: number;
};

export function isPcTransactionCategory(category: string) {
  return normalizeTransactionCategoryKey(category) === "pc";
}

export type PcLedgerTxnInput = {
  id: number;
  amount: number;
  category: string;
  district_id: number | null;
  txn_date: string;
  party: string;
  type: string;
};

export function pcLedgerTransactionsForFinancialYear(
  rows: PcLedgerTxnInput[],
  yearId: number,
  financialYearIdForTxnDate: (isoDate: string) => number | null,
  districtNameById: Record<number, string>,
): PcLedgerTransactionRow[] {
  const lines: PcLedgerTransactionRow[] = [];

  for (const row of rows) {
    if (row.type !== "out") continue;
    if (!isPcTransactionCategory(row.category)) continue;
    if (financialYearIdForTxnDate(row.txn_date) !== yearId) continue;

    const districtId = row.district_id;
    if (districtId == null || districtId <= 0) continue;

    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    lines.push({
      id: row.id,
      districtId,
      districtName: districtNameById[districtId] ?? `District #${districtId}`,
      txnDate: row.txn_date,
      party: row.party?.trim() || "—",
      amount,
    });
  }

  return lines.sort((a, b) => {
    const byDistrict = a.districtName.localeCompare(b.districtName);
    if (byDistrict !== 0) return byDistrict;
    return b.txnDate.localeCompare(a.txnDate);
  });
}

export function pcDistrictSummaries(
  districts: Array<{ districtId: number; districtName: string }>,
  lines: PcLedgerTransactionRow[],
): PcDistrictSummaryRow[] {
  const totals = new Map<number, number>();
  for (const line of lines) {
    totals.set(line.districtId, (totals.get(line.districtId) ?? 0) + line.amount);
  }

  const rows: PcDistrictSummaryRow[] = districts.map((district) => ({
    districtId: district.districtId,
    districtName: district.districtName,
    amount: totals.get(district.districtId) ?? 0,
  }));

  const known = new Set(districts.map((d) => d.districtId));
  for (const [districtId, amount] of totals) {
    if (known.has(districtId) || amount <= 0) continue;
    const name = lines.find((line) => line.districtId === districtId)?.districtName ?? `District #${districtId}`;
    rows.push({ districtId, districtName: name, amount });
  }

  return rows.sort((a, b) => a.districtName.localeCompare(b.districtName));
}

export function sumPcAmount(lines: PcLedgerTransactionRow[] | PcDistrictSummaryRow[]) {
  return lines.reduce((sum, row) => sum + row.amount, 0);
}
