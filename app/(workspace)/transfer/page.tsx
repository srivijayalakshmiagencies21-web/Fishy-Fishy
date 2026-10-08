import { redirect } from "next/navigation";
import { TransferPointForm } from "@/components/transfer-form";
import { landingPath } from "@/lib/access";
import { loadTransferJourneys } from "@/lib/cached-journeys.server";
import { loadPointFormMasters } from "@/lib/cached-masters.server";
import { getSessionUser } from "@/lib/session";

export default async function TransferPointPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("transfer")) redirect(landingPath(user.pages));

  const [masters, activeJourneys] = await Promise.all([
    loadPointFormMasters(),
    loadTransferJourneys(user.id),
  ]);

  return (
    <TransferPointForm
      activeJourneys={activeJourneys}
      suppliers={masters.suppliers}
      transporters={masters.transporters}
      fishes={masters.fishes}
      districts={masters.districts}
    />
  );
}
