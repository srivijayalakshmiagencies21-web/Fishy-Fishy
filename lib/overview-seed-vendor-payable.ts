import type { FinancialYear } from "@/lib/financial-year";
import type { VendorPaidAggregate } from "@/lib/overview-vendor-paid";
import {
  computeLineAmount,
  type JourneyRateRecord,
  type JourneyRateSupplierLine,
} from "@/lib/journey-rates";
import { journeyClosedInFinancialYear } from "@/lib/overview-sales";

export type SeedVendorPayableRow = {
  vendorName: string;
  billed: number | null;
  paid: number;
};

function supplierLineBilled(line: JourneyRateSupplierLine): number | null {
  if (line.rate == null) return null;
  return computeLineAmount(line.quantity, String(line.rate));
}

function addBilled(current: number | null, next: number | null): number | null {
  if (next == null) return current;
  return (current ?? 0) + next;
}

/** Vendors from vendor-rate supplier lines on closed journeys in `year` (IST close date). */
export function seedVendorPayableRowsForFinancialYear(
  records: JourneyRateRecord[],
  year: FinancialYear,
): SeedVendorPayableRow[] {
  const byVendor = new Map<string, { vendorName: string; billed: number | null }>();

  for (const record of records) {
    if (!record.closedAt || !journeyClosedInFinancialYear(record.closedAt, year)) continue;

    for (const line of record.suppliers) {
      const vendorName = line.supplier.trim() || "Unknown";
      const key = vendorName.toLowerCase();
      const lineBilled = supplierLineBilled(line);
      const existing = byVendor.get(key) ?? { vendorName, billed: null };
      existing.billed = addBilled(existing.billed, lineBilled);
      byVendor.set(key, existing);
    }
  }

  return [...byVendor.values()]
    .map((row) => ({ ...row, paid: 0 }))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

export function applySeedVendorPaid(
  rows: SeedVendorPayableRow[],
  paidByKey: Record<string, VendorPaidAggregate>,
): SeedVendorPayableRow[] {
  const merged = rows.map((row) => ({
    ...row,
    paid: paidByKey[row.vendorName.trim().toLowerCase()]?.amount ?? row.paid ?? 0,
  }));

  const seen = new Set(merged.map((row) => row.vendorName.trim().toLowerCase()));
  for (const [key, entry] of Object.entries(paidByKey)) {
    if (entry.amount <= 0 || seen.has(key)) continue;
    merged.push({
      vendorName: entry.label,
      billed: null,
      paid: entry.amount,
    });
  }

  return merged.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}
