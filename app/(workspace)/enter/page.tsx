import { redirect } from "next/navigation";
import { landingPath } from "@/lib/access";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Lightweight post-login hop: resolve role pages once, then send user to their home page. */
export default async function EnterWorkspacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(landingPath(user.pages));
}
