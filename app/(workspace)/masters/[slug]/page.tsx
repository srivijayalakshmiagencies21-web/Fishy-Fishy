import { notFound, redirect } from "next/navigation";
import { MasterPanel } from "@/components/master-panel";
import { RememberMaster } from "@/components/remember-master";
import { landingPath } from "@/lib/access";
import { getMasterLink } from "@/lib/master-links";
import { loadMasterCached } from "@/lib/cached-masters.server";
import { getSessionUser } from "@/lib/session";

export default async function MasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.pages.includes("masters")) {
    redirect(landingPath(user.pages));
  }

  const { slug } = await params;
  if (slug === "expenses" || slug === "transaction-categories") {
    redirect("/masters/transactions");
  }
  const { error } = await searchParams;
  const master = getMasterLink(slug);

  if (!master) {
    notFound();
  }

  const data = await loadMasterCached(slug);

  return (
    <>
      <RememberMaster slug={slug} data={data} notice={error ?? null} />
      <MasterPanel data={data} notice={error ?? null} />
    </>
  );
}
