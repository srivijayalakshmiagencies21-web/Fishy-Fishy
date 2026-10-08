"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AdminTab = "users" | "roles";

type NavIntentValue = {
  adminTab: AdminTab | null;
  previewMaster: string | null;
  armAdmin: (tab: AdminTab) => void;
  armMaster: (slug: string) => void;
};

const NavIntentContext = createContext<NavIntentValue | null>(null);

export function NavIntentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [adminTab, setAdminTab] = useState<AdminTab | null>(null);
  const [previewMaster, setPreviewMaster] = useState<string | null>(null);

  useEffect(() => {
    if (adminTab === "users" && pathname.startsWith("/admin/users")) setAdminTab(null);
    if (adminTab === "roles" && pathname.startsWith("/admin/roles")) setAdminTab(null);
    if (previewMaster && pathname === `/masters/${previewMaster}`) setPreviewMaster(null);
  }, [pathname, adminTab, previewMaster]);

  const value = useMemo(
    () => ({
      adminTab,
      previewMaster,
      armAdmin: setAdminTab,
      armMaster: setPreviewMaster,
    }),
    [adminTab, previewMaster],
  );

  return <NavIntentContext.Provider value={value}>{children}</NavIntentContext.Provider>;
}

export function useNavIntent() {
  const value = useContext(NavIntentContext);
  if (!value) {
    throw new Error("useNavIntent must be used inside NavIntentProvider");
  }
  return value;
}
