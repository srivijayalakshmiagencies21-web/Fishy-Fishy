import { normalizeTransactionCategoryKey } from "@/lib/finance-party-vendors";

export function seedVendorLedgerKey(vendorName: string) {
  return vendorName.trim().toLowerCase();
}

/** Matches keys used in `transportVendorPayableRowsForFinancialYear`. */
export function transportVendorLedgerKey(vendorName: string) {
  const parts = vendorName.split("·").map((part) => part.trim());
  if (parts.length < 2) return vendorName.trim().toLowerCase();
  const transporter = parts[0] ?? "";
  const scopeLabel = parts.slice(1).join("·").trim().toLowerCase();
  const scopeKey = scopeLabel === "local" ? "local" : "non-local";
  return `${scopeKey}:${transporter.toLowerCase()}`;
}

export function transportPaidKeyFromParty(scope: "local" | "non-local", party: string) {
  return `${scope}:${party.trim().toLowerCase()}`;
}

export type VendorPaidTxnRow = {
  amount: number;
  category: string;
  party: string;
  txn_date: string;
  type: string;
};

export type VendorPaidAggregate = { amount: number; label: string };

function addPaid(
  map: Record<string, VendorPaidAggregate>,
  key: string,
  party: string,
  amount: number,
) {
  const existing = map[key];
  if (existing) {
    existing.amount += amount;
    return;
  }
  map[key] = { amount, label: party };
}

export function aggregateVendorPaidFromTransactions(
  rows: VendorPaidTxnRow[],
  yearId: number,
  financialYearIdForTxnDate: (isoDate: string) => number | null,
): { seedByKey: Record<string, VendorPaidAggregate>; transportByKey: Record<string, VendorPaidAggregate> } {
  const seedByKey: Record<string, VendorPaidAggregate> = {};
  const transportByKey: Record<string, VendorPaidAggregate> = {};

  for (const row of rows) {
    if (row.type !== "out") continue;
    const txnYearId = financialYearIdForTxnDate(row.txn_date);
    if (txnYearId !== yearId) continue;

    const amount = Number(row.amount);
    const party = row.party?.trim();
    if (!party || !Number.isFinite(amount) || amount <= 0) continue;

    const catKey = normalizeTransactionCategoryKey(row.category);
    if (catKey === "seed vendor") {
      addPaid(seedByKey, seedVendorLedgerKey(party), party, amount);
    } else if (catKey === "transport local vendor") {
      addPaid(transportByKey, transportPaidKeyFromParty("local", party), party, amount);
    } else if (catKey === "transport non local vendor") {
      addPaid(transportByKey, transportPaidKeyFromParty("non-local", party), party, amount);
    }
  }

  return { seedByKey, transportByKey };
}
