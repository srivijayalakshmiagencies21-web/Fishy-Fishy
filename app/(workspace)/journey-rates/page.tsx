import { redirect } from "next/navigation";
import { JourneyRatesView } from "@/components/journey-rates-view";
import { landingPath } from "@/lib/access";
import { loadJourneyRatesData } from "@/lib/journey-rates.server";
import { getSessionUser } from "@/lib/session";

export default async function JourneyRatesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("journey-rates")) redirect(landingPath(user.pages));

  const { rows, initialRateTexts, error } = await loadJourneyRatesData();

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <JourneyRatesView rows={rows} initialRateTexts={initialRateTexts} error={error} />
    </div>
  );
}
