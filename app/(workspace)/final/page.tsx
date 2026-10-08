import { redirect } from "next/navigation";
import { FinalPointForm } from "@/components/final-point-form";
import { landingPath } from "@/lib/access";
import { loadFinalJourneys } from "@/lib/cached-journeys.server";
import { loadDistrictsCached } from "@/lib/cached-masters.server";
import { getSessionUser } from "@/lib/session";

export default async function FinalPointPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.pages.includes("final")) redirect(landingPath(user.pages));

  const [activeJourneys, districts] = await Promise.all([loadFinalJourneys(user.id), loadDistrictsCached()]);

  return <FinalPointForm journeys={activeJourneys} districts={districts} />;
}
