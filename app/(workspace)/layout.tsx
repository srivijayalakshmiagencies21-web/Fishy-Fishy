import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NavIntentProvider } from "@/components/nav-intent";
import { resolveSelectedFinancialYearId } from "@/lib/financial-year.server";
import { loadFinancialYearsFromGovtLedger } from "@/lib/govt-rates.server";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const financialYears = await loadFinancialYearsFromGovtLedger();
  const selectedFinancialYearId = await resolveSelectedFinancialYearId(financialYears);

  return (
    <NavIntentProvider>
      <AppShell
        email={user.email}
        role={user.role}
        pages={user.pages}
        financialYears={financialYears}
        selectedFinancialYearId={selectedFinancialYearId}
      >
        {children}
      </AppShell>
    </NavIntentProvider>
  );
}
