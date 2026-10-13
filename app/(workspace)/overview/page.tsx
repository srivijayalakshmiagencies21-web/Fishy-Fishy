import { redirect } from "next/navigation";
import { landingPath } from "@/lib/access";
import { OverviewWorkspace } from "@/components/overview-workspace";
import { resolveSelectedFinancialYearId } from "@/lib/financial-year.server";
import { loadFinalPointQtyByDistrictForYear } from "@/lib/overview-current-sales.server";
import { loadSeedVendorPayableRowsForYear } from "@/lib/overview-seed-vendor-payable.server";
import { loadTransportVendorPayableRowsForYear } from "@/lib/overview-transport-vendor-payable.server";
import { loadIncomeReceivedByDistrictForYear } from "@/lib/overview-received-income.server";
import { loadExpensesLedgerForFinancialYear } from "@/lib/overview-expenses.server";
import { loadPcLedgerTransactionsForFinancialYear } from "@/lib/overview-pc.server";
import { loadFinancialYearsFromGovtLedger, loadGovtRateLedger } from "@/lib/govt-rates.server";
import { getSessionUser } from "@/lib/session";

export default async function OverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("overview")) redirect(landingPath(user.pages));

  const financialYears = await loadFinancialYearsFromGovtLedger();
  const selectedYearId = await resolveSelectedFinancialYearId(financialYears);
  const selectedYear = selectedYearId != null
    ? financialYears.find((year) => year.id === selectedYearId) ?? null
    : null;
  const govtLedgerRows = await loadGovtRateLedger();
  const salesRows =
    selectedYearId != null
      ? govtLedgerRows.filter((row) => row.financialYearId === selectedYearId)
      : [];
  const districtNameById = Object.fromEntries(
    salesRows.map((row) => [row.districtId, row.districtName]),
  );
  const [
    finalPointQtyByDistrict,
    incomeReceivedByDistrict,
    seedVendorPayableRows,
    transportVendorPayableRows,
    pcLedgerTransactions,
    expensesLedger,
  ] = await Promise.all([
    loadFinalPointQtyByDistrictForYear(selectedYear),
    loadIncomeReceivedByDistrictForYear(selectedYearId),
    loadSeedVendorPayableRowsForYear(selectedYear, financialYears),
    loadTransportVendorPayableRowsForYear(selectedYear, financialYears),
    loadPcLedgerTransactionsForFinancialYear(selectedYear, financialYears, districtNameById),
    loadExpensesLedgerForFinancialYear(selectedYear, financialYears),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <OverviewWorkspace
        salesRows={salesRows}
        finalPointQtyByDistrict={finalPointQtyByDistrict}
        incomeReceivedByDistrict={incomeReceivedByDistrict}
        seedVendorPayableRows={seedVendorPayableRows}
        transportVendorPayableRows={transportVendorPayableRows}
        pcLedgerTransactions={pcLedgerTransactions}
        expensesLedgerTransactions={expensesLedger.transactions}
        expenseCategoryNames={expensesLedger.categoryNames}
        financialYearLabel={selectedYear?.label ?? "—"}
      />
    </div>
  );
}
