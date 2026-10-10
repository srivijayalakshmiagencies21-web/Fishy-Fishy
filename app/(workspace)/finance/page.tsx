import { redirect } from "next/navigation";
import { landingPath } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

/** Legacy URL — send users to the finance page their role allows. */
export default async function FinanceRedirectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.pages.includes("finance-manager")) redirect("/finance-manager");
  if (user.pages.includes("finance-executive")) redirect("/finance-executive");
  redirect(landingPath(user.pages));
}
