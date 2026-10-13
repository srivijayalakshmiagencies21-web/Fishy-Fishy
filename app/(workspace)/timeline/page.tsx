import { redirect } from "next/navigation";
import { OverviewTracker } from "@/components/overview-tracker";
import { landingPath } from "@/lib/access";
import { loadOverviewJourneys } from "@/lib/cached-journeys.server";
import { resolveSelectedFinancialYearId } from "@/lib/financial-year.server";
import { loadFinancialYearsFromGovtLedger, loadGovtRateLedger } from "@/lib/govt-rates.server";
import { timelineDistrictFulfillmentRows, overviewJourneyInFinancialYear } from "@/lib/overview-timeline";
import { getSessionUser } from "@/lib/session";

export default async function TimelinePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("timeline")) redirect(landingPath(user.pages));

  const financialYears = await loadFinancialYearsFromGovtLedger();
  const selectedYearId = await resolveSelectedFinancialYearId(financialYears);
  const selectedYear =
    selectedYearId != null ? financialYears.find((year) => year.id === selectedYearId) ?? null : null;

  const allJourneys = await loadOverviewJourneys(user.id);
  const journeys =
    selectedYear != null
      ? allJourneys.filter((journey) => overviewJourneyInFinancialYear(journey, selectedYear))
      : allJourneys;
  const govtLedgerRows = await loadGovtRateLedger();
  const govtRowsForYear =
    selectedYearId != null
      ? govtLedgerRows.filter((row) => row.financialYearId === selectedYearId)
      : [];
  const districtFulfillmentRows = timelineDistrictFulfillmentRows(journeys, govtRowsForYear);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <OverviewTracker
        journeys={journeys}
        districtFulfillmentRows={districtFulfillmentRows}
        financialYearLabel={selectedYear?.label ?? null}
      />
    </div>
  );
}
