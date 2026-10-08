import { redirect } from "next/navigation";
import { landingPath } from "@/lib/access";
import { loadStartPageJourneys } from "@/lib/cached-journeys.server";
import { loadPointFormMasters } from "@/lib/cached-masters.server";
import { getSessionUser } from "@/lib/session";
import { StartPointForm } from "@/components/start-form";

export default async function StartPointPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("start")) redirect(landingPath(user.pages));

  const [masters, { activeJourneys, totalJourneys }] = await Promise.all([
    loadPointFormMasters(),
    loadStartPageJourneys(user.id),
  ]);

  return (
    <StartPointForm
      suppliers={masters.suppliers}
      fishes={masters.fishes}
      transporters={masters.transporters}
      districts={masters.districts}
      activeJourneys={activeJourneys}
      totalJourneys={totalJourneys}
    />
  );
}
