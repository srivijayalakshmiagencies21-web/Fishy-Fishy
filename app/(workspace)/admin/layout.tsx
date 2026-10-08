import { redirect } from "next/navigation";
import { UserManagement } from "@/components/user-management";
import { landingPath } from "@/lib/access";
import { loadDirectory } from "@/lib/directory";
import { getSessionUser } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.pages.includes("users") && user.role !== "Manager") {
    redirect(landingPath(user.pages));
  }

  const directory = await loadDirectory();

  return (
    <>
      <UserManagement
        currentUserId={user.id}
        actorRole={user.role}
        canManageRoles={user.pages.includes("users")}
        initialRoles={directory.roles}
        initialUsers={directory.users}
        initialError={directory.error}
      />
      {children}
    </>
  );
}
