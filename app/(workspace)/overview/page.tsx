import { redirect } from "next/navigation";
import { OverviewTracker } from "@/components/overview-tracker";
import { landingPath } from "@/lib/access";
import { loadOverviewJourneys } from "@/lib/cached-journeys.server";
import { getSessionUser } from "@/lib/session";

export default async function OverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("overview")) redirect(landingPath(user.pages));

  const allJourneys = await loadOverviewJourneys(user.id);

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <OverviewTracker journeys={allJourneys} />
    </div>
  );
}
