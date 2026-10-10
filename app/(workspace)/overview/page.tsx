import { redirect } from "next/navigation";
import { landingPath } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

/** Legacy URL — Timeline page. */
export default async function OverviewRedirectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.pages.includes("timeline")) redirect("/timeline");
  redirect(landingPath(user.pages));
}
