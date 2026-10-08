"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, startTransition } from "react";
import { flushSync } from "react-dom";
import { prefetchMasters } from "@/components/master-cache";
import { useNavIntent } from "@/components/nav-intent";
import { appPages } from "@/lib/access";
import { masterLinks } from "@/lib/master-links";
import { createClient } from "@/lib/supabase/client";

type AppShellProps = {
  email: string;
  role: string;
  pages: string[];
  children: React.ReactNode;
};

const navItems = appPages.map((page) => ({ key: page.key, href: page.href, label: page.label }));

function navIsActive(key: string, pathname: string) {
  if (key === "masters") return pathname.startsWith("/masters");
  if (key === "users") return pathname.startsWith("/admin");
  return pathname === navItems.find((item) => item.key === key)?.href;
}

export function AppShell({ email, role, pages, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { adminTab, previewMaster, armAdmin, armMaster } = useNavIntent();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const current = masterLinks.find((link) => pathname === `/masters/${link.slug}`);
  const shownMaster = masterLinks.find((link) => link.slug === (previewMaster ?? current?.slug)) ?? current;
  const directoryTab = adminTab ?? (pathname.startsWith("/admin/roles") ? "roles" : "users");
  const onMasters = pathname.startsWith("/masters");
  const onUsers = pathname.startsWith("/admin");
  const currentPage = appPages.find((page) => page.href === pathname);
  const visibleNav = navItems
    .filter((item) => pages.includes(item.key) || (item.key === "users" && role === "Manager"))
    .map((item) => {
      let shortLabel: string = item.label;
      if (item.key === "start") shortLabel = "Start";
      if (item.key === "transfer") shortLabel = "Transfer";
      if (item.key === "final") shortLabel = "Final";
      if (item.key === "users") shortLabel = "Users";
      if (item.key === "masters") shortLabel = "Masters";
      return { 
        ...item, 
        label: item.key === "users" && !pages.includes("users") ? "Users" : item.label,
        shortLabel
      };
    });
  const name = email.split("@")[0] || "Signed in";
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "5.25rem" : "16rem");
  }, [collapsed]);

  useEffect(() => {
    if (pages.includes("masters")) {
      void prefetchMasters();
      for (const link of masterLinks) router.prefetch(`/masters/${link.slug}`);
    }
    if (pages.includes("users") || role === "Manager") {
      router.prefetch("/admin/users");
      if (pages.includes("users")) router.prefetch("/admin/roles");
    }
    for (const item of navItems) {
      if (item.key !== "masters" && item.key !== "users" && pages.includes(item.key)) {
        router.prefetch(item.href);
      }
    }
  }, [pages, role, router]);

  function openHref(event: React.MouseEvent<HTMLAnchorElement>, href: string, paint?: () => void) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (pathname === href) return;
    event.preventDefault();
    if (paint) flushSync(paint);
    startTransition(() => router.push(href));
  }

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const dayName = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent text-[var(--text-primary)]">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-side" />
          <div className="header-mobile-brand flex flex-col items-center justify-center md:hidden">
            <div className="flex items-center gap-2">
              <span className="brand-mark h-5 text-blue-dark" role="img" aria-hidden="true" />
              <p className="header-brand">Fishy-Fishy</p>
            </div>
            <p className="header-tagline">Seed logistics</p>
          </div>
          <div className="header-clock hidden items-center justify-center md:flex">
            <span>{dayName}</span>
            <span className="header-clock-sep">|</span>
            <span>{monthDay}</span>
            <span className="header-clock-sep">|</span>
            <span>{timeStr}</span>
          </div>
          <div className="header-side header-side--right">
            <div className="relative">
              <button type="button" className="header-avatar" aria-label="Account menu" onClick={() => setMenuOpen((open) => !open)}>
                {initial}
              </button>
              {menuOpen ? (
                <div className="account-menu">
                  <div className="border-b border-[var(--border)] px-3 py-2.5">
                    <p className="text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">Account</p>
                    <p className="mt-1 truncate text-sm font-medium">{email}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{role || "No role"}</p>
                  </div>
                  <button type="button" className="w-full px-3 py-2.5 text-left text-sm" onClick={onSignOut}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <aside className={`app-sidebar ${collapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark sidebar-logo" role="img" aria-label={collapsed ? "Fishy-Fishy" : undefined} />
          <div className="sidebar-label flex flex-col justify-center">
            <p className="sidebar-brand-name leading-none">Fishy-Fishy</p>
            <p className="mt-1 text-[0.65rem] font-bold tracking-widest text-white/70 uppercase">Seed Logistics</p>
          </div>
        </div>
        <nav className="sidebar-nav flex flex-col gap-1.5 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2">
          {visibleNav.map((item) => {
            const active = navIsActive(item.key, pathname);
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`sidebar-nav-link ${active ? "is-active" : ""}`}
                onClick={(event) =>
                  openHref(
                    event,
                    item.href,
                    item.key === "masters" ? () => armMaster("accounts") : item.key === "users" ? () => armAdmin("users") : undefined,
                  )
                }
              >
                {active ? <span className="absolute left-0 h-5 w-1 rounded-r-full bg-white" /> : null}
                <span className="sidebar-nav-icon">
                  <NavIcon name={item.key} />
                </span>
                <span className="sidebar-label text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="sidebar-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="sidebar-nav-icon">
              <PanelIcon collapsed={collapsed} />
            </span>
            <span className="sidebar-label">Collapse</span>
          </button>
        </div>
      </aside>

      <div className="app-shell">
        <main className="app-main">
          <div className="content-canvas">
            <div className="canvas-page-header">
              <h1 className="page-title">
                {onUsers
                  ? (pages.includes("users") ? "Users & Roles" : "Users")
                  : pathname.startsWith("/account")
                    ? "Account"
                    : onMasters
                      ? (shownMaster?.label ?? "Masters")
                      : (currentPage?.label ?? "Fishy-Fishy")}
              </h1>
              {onUsers ? (
                <p className="page-subtitle">
                  {pages.includes("users")
                    ? "Accounts and the pages each role can open."
                    : "Reset passwords and deactivate managers or employees."}
                </p>
              ) : shownMaster && onMasters ? (
                <p className="page-subtitle">{shownMaster.description}</p>
              ) : currentPage && !onMasters && !pathname.startsWith("/account") ? (
                <p className="page-subtitle">{currentPage.description}</p>
              ) : null}
              {onMasters ? (
                <div className="segmented-control mt-4" role="tablist" aria-label="Masters">
                  {masterLinks.map((link) => {
                    const href = `/masters/${link.slug}`;
                    const selected = (previewMaster ? `/masters/${previewMaster}` : pathname) === href;
                    return (
                      <Link
                        key={link.slug}
                        href={href}
                        prefetch
                        scroll={false}
                        role="tab"
                        aria-selected={selected}
                        className={`segmented-btn ${selected ? "active" : ""}`}
                        onClick={(event) => openHref(event, href, () => armMaster(link.slug))}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              {onUsers && pages.includes("users") ? (
                <div className="segmented-control mt-4" role="tablist" aria-label="Users & Roles">
                  <Link
                    href="/admin/users"
                    prefetch
                    scroll={false}
                    role="tab"
                    aria-selected={directoryTab === "users"}
                    className={`segmented-btn ${directoryTab === "users" ? "active" : ""}`}
                    onClick={(event) => openHref(event, "/admin/users", () => armAdmin("users"))}
                  >
                    Users
                  </Link>
                  <Link
                    href="/admin/roles"
                    prefetch
                    scroll={false}
                    role="tab"
                    aria-selected={directoryTab === "roles"}
                    className={`segmented-btn ${directoryTab === "roles" ? "active" : ""}`}
                    onClick={(event) => openHref(event, "/admin/roles", () => armAdmin("roles"))}
                  >
                    Roles
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="canvas-body">{children}</div>
          </div>
        </main>
      </div>

      <nav className="mobile-tabbar" aria-label="Main">
        {visibleNav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch
            className="flex flex-1 flex-col items-center justify-start pt-2 pb-1 text-white"
            onClick={(event) =>
              openHref(
                event,
                item.href,
                item.key === "masters" ? () => armMaster("accounts") : item.key === "users" ? () => armAdmin("users") : undefined,
              )
            }
          >
            <span className="rounded-full bg-white/20 p-1.5 flex items-center justify-center">
              <NavIcon name={item.key} />
            </span>
            <span className="mt-1 text-[0.6rem] font-semibold tracking-wide uppercase text-center">{item.shortLabel}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  if (name === "overview") return <OverviewIcon />;
  if (name === "masters") return <MastersIcon />;
  if (name === "users") return <UsersIcon />;
  if (name === "start") return <StartIcon />;
  if (name === "transfer") return <TransferIcon />;
  return <FinalIcon />;
}

function OverviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
      <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
    </svg>
  );
}

function StartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

function FinalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MastersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    </svg>
  );
}

function PanelIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d={collapsed ? "M9 3v18" : "M15 3v18"} />
    </svg>
  );
}
