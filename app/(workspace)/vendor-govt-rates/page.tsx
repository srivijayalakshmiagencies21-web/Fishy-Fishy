import { redirect } from "next/navigation";
import { JourneyRatesView } from "@/components/journey-rates-view";
import { landingPath } from "@/lib/access";
import { loadMasterCached } from "@/lib/cached-masters.server";
import { loadFinancialYears } from "@/lib/financial-year.server";
import { loadGovtRateLedger } from "@/lib/govt-rates.server";
import { loadJourneyRatesData } from "@/lib/journey-rates.server";
import { getSessionUser } from "@/lib/session";

export default async function VendorGovtRatesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("vendor-govt-rates")) redirect(landingPath(user.pages));

  const [{ rows, initialRateTexts, error }, financialYears, districtsMaster, govtLedgerRows] =
    await Promise.all([
      loadJourneyRatesData(),
      loadFinancialYears(),
      loadMasterCached("districts"),
      loadGovtRateLedger(),
    ]);

  const districts = districtsMaster.kind === "districts" ? districtsMaster.rows : [];

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <JourneyRatesView
        rows={rows}
        initialRateTexts={initialRateTexts}
        error={error}
        financialYears={financialYears}
        districts={districts}
        govtLedgerRows={govtLedgerRows}
        canEditGovtSetup={user.pages.includes("vendor-govt-rates")}
      />
    </div>
  );
}
