import { redirect } from "next/navigation";
import { JourneyRatesView } from "@/components/journey-rates-view";
import { landingPath } from "@/lib/access";
import { loadMasterCached } from "@/lib/cached-masters.server";
import { loadFinancialYears, resolveSelectedFinancialYearId } from "@/lib/financial-year.server";
import { loadFinancialYearsFromGovtLedger, loadGovtRateLedger } from "@/lib/govt-rates.server";
import { loadJourneyRatesData } from "@/lib/journey-rates.server";
import { journeyClosedInFinancialYear } from "@/lib/overview-sales";
import { getSessionUser } from "@/lib/session";

export default async function VendorGovtRatesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("vendor-govt-rates")) redirect(landingPath(user.pages));

  const [{ rows, initialRateTexts, error }, financialYears, headerYears, districtsMaster, govtLedgerRows] =
    await Promise.all([
      loadJourneyRatesData(),
      loadFinancialYears(),
      loadFinancialYearsFromGovtLedger(),
      loadMasterCached("districts"),
      loadGovtRateLedger(),
    ]);

  // Same FY the header picker shows (resolved from the govt-ledger FY list, like the layout).
  const selectedYearId = await resolveSelectedFinancialYearId(headerYears);
  const selectedYear = headerYears.find((year) => year.id === selectedYearId) ?? null;

  const rowsForYear = selectedYear
    ? rows.filter((record) => record.closedAt && journeyClosedInFinancialYear(record.closedAt, selectedYear))
    : rows;
  const govtRowsForYear = selectedYear
    ? govtLedgerRows.filter((row) => row.financialYearId === selectedYear.id)
    : govtLedgerRows;

  const districts = districtsMaster.kind === "districts" ? districtsMaster.rows : [];

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <JourneyRatesView
        rows={rowsForYear}
        initialRateTexts={initialRateTexts}
        error={error}
        financialYears={financialYears}
        financialYearLabel={selectedYear?.label ?? null}
        districts={districts}
        govtLedgerRows={govtRowsForYear}
        canEditGovtSetup={user.pages.includes("vendor-govt-rates")}
      />
    </div>
  );
}
