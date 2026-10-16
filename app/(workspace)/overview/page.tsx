import { redirect } from "next/navigation";
import { landingPath } from "@/lib/access";
import { OverviewWorkspace } from "@/components/overview-workspace";
import { resolveSelectedFinancialYearId } from "@/lib/financial-year.server";
import { loadFinancialYearsFromGovtLedger } from "@/lib/govt-rates.server";
import { loadOverviewData } from "@/lib/overview-data.server";
import { getSessionUser } from "@/lib/session";

export default async function OverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("overview")) redirect(landingPath(user.pages));

  const financialYears = await loadFinancialYearsFromGovtLedger(user.id);
  const selectedYearId = await resolveSelectedFinancialYearId(financialYears);
  const selectedYear = selectedYearId != null
    ? financialYears.find((year) => year.id === selectedYearId) ?? null
    : null;
  const data = await loadOverviewData(user.id, financialYears, selectedYear);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <OverviewWorkspace
        salesRows={data.salesRows}
        finalPointQtyByDistrict={data.finalPointQtyByDistrict}
        incomeReceivedByDistrict={data.incomeReceivedByDistrict}
        seedVendorPayableRows={data.seedVendorPayableRows}
        transportVendorPayableRows={data.transportVendorPayableRows}
        pcLedgerTransactions={data.pcLedgerTransactions}
        expensesLedgerTransactions={data.expensesLedgerTransactions}
        expenseCategoryNames={data.expenseCategoryNames}
        financialYearLabel={selectedYear?.label ?? "—"}
      />
    </div>
  );
}
