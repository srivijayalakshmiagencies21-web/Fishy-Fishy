import { redirect } from "next/navigation";
import { TransactionsView } from "@/components/transactions-view";
import { landingPath } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { loadTransactionsPageData } from "@/lib/transactions.server";

export default async function FinancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("finance")) redirect(landingPath(user.pages));

  const data = await loadTransactionsPageData();

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <TransactionsView
        rows={data.rows}
        accounts={data.accounts}
        paymentModes={data.paymentModes}
        categories={data.categories}
        journeys={data.journeys}
        loadError={data.error}
      />
    </div>
  );
}
