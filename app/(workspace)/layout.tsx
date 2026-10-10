import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NavIntentProvider } from "@/components/nav-intent";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <NavIntentProvider>
      <AppShell email={user.email} role={user.role} pages={user.pages}>
        {children}
      </AppShell>
    </NavIntentProvider>
  );
}
