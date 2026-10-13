export const appPages = [
  { key: "overview", label: "Overview", href: "/overview", description: "Operational overview and key performance indicators." },
  { key: "timeline", label: "Timeline", href: "/timeline", description: "Track active journeys across all points." },
  {
    key: "vendor-govt-rates",
    label: "Vendor & Govt Rates",
    href: "/vendor-govt-rates",
    description: "Closed journeys: supplier quantities and transporter kilometres.",
  },
  {
    key: "finance-manager",
    label: "Finance Manager",
    href: "/finance-manager",
    description: "Ledger and cost-nature KPIs for managers.",
  },
  { key: "masters", label: "Masters", href: "/masters/accounts", description: "Reference lists used across the workspace." },
  { key: "users", label: "Users & Roles", href: "/admin/users", description: "Accounts and the pages each role can open." },
  {
    key: "finance-executive",
    label: "Finance Executive",
    href: "/finance-executive",
    description: "Wallet ledger and executive KPIs.",
  },
  { key: "start", label: "Start Point", href: "/start", description: "Where a load leaves from." },
  { key: "transfer", label: "Transfer Point", href: "/transfer", description: "Where a load changes hands." },
  { key: "final", label: "Final Point", href: "/final", description: "Where a load arrives." },
] as const;

export type AppPageKey = (typeof appPages)[number]["key"];

/** Retired RBAC keys still stored on roles until migrations run. */
const LEGACY_PAGE_KEYS: Record<string, AppPageKey> = {
  "journey-rates": "vendor-govt-rates",
};

export function normalizeUserPages(pages: string[]): string[] {
  const out = new Set<string>();
  for (const page of pages) {
    out.add(LEGACY_PAGE_KEYS[page] ?? page);
  }
  return [...out];
}

export function landingPath(pages: string[]) {
  const normalized = normalizeUserPages(pages);
  return appPages.find((page) => normalized.includes(page.key))?.href ?? "/account";
}

export function pageLabel(key: string) {
  const normalized = LEGACY_PAGE_KEYS[key] ?? key;
  return appPages.find((page) => page.key === normalized)?.label ?? normalized;
}
