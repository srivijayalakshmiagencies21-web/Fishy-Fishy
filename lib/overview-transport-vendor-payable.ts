import type { FinancialYear } from "@/lib/financial-year";
import {
  computeLineAmount,
  type JourneyRateRecord,
  type JourneyRateTransporterLine,
} from "@/lib/journey-rates";
import { journeyClosedInFinancialYear } from "@/lib/overview-sales";

import { transportVendorLedgerKey, type VendorPaidAggregate } from "@/lib/overview-vendor-paid";

export type TransportVendorPayableRow = {
  vendorName: string;
  billed: number | null;
  paid: number;
};

function transporterLineBilled(line: JourneyRateTransporterLine): number | null {
  if (line.rate == null) return null;
  return computeLineAmount(line.kilometers, String(line.rate));
}

function addBilled(current: number | null, next: number | null): number | null {
  if (next == null) return current;
  return (current ?? 0) + next;
}

function transporterScopeLabel(scope: "Local" | "Non-Local") {
  return scope === "Local" ? "Local" : "Non-Local";
}

/** Transporters from vendor-rate lines on closed journeys in `year` (IST close date). */
export function transportVendorPayableRowsForFinancialYear(
  records: JourneyRateRecord[],
  year: FinancialYear,
): TransportVendorPayableRow[] {
  const byVendor = new Map<string, { vendorName: string; billed: number | null }>();

  for (const record of records) {
    if (!record.closedAt || !journeyClosedInFinancialYear(record.closedAt, year)) continue;

    const groups: { scope: "Local" | "Non-Local"; lines: JourneyRateTransporterLine[] }[] = [
      { scope: "Local", lines: record.localTransporters },
      { scope: "Non-Local", lines: record.nonLocalTransporters },
    ];

    for (const { scope, lines } of groups) {
      const scopeLabel = transporterScopeLabel(scope);
      for (const line of lines) {
        const transporter = line.transporter.trim() || "Unknown";
        const vendorName = `${transporter} · ${scopeLabel}`;
        const key = `${scopeLabel.toLowerCase()}:${transporter.toLowerCase()}`;
        const lineBilled = transporterLineBilled(line);
        const existing = byVendor.get(key) ?? { vendorName, billed: null };
        existing.billed = addBilled(existing.billed, lineBilled);
        byVendor.set(key, existing);
      }
    }
  }

  return [...byVendor.values()]
    .map((row) => ({ ...row, paid: 0 }))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

export function applyTransportVendorPaid(
  rows: TransportVendorPayableRow[],
  paidByKey: Record<string, VendorPaidAggregate>,
): TransportVendorPayableRow[] {
  const merged = rows.map((row) => ({
    ...row,
    paid: paidByKey[transportVendorLedgerKey(row.vendorName)]?.amount ?? row.paid ?? 0,
  }));

  const seen = new Set(merged.map((row) => transportVendorLedgerKey(row.vendorName)));
  for (const [key, entry] of Object.entries(paidByKey)) {
    if (entry.amount <= 0 || seen.has(key)) continue;
    const [scopeKey, ...nameParts] = key.split(":");
    const transporter = entry.label.trim() || nameParts.join(":").trim();
    const scopeLabel = scopeKey === "local" ? "Local" : "Non-Local";
    const vendorName = transporter ? `${transporter} · ${scopeLabel}` : key;
    merged.push({
      vendorName,
      billed: null,
      paid: entry.amount,
    });
  }

  return merged.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}
