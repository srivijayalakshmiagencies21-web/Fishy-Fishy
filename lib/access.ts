export const appPages = [
  { key: "masters", label: "Masters", href: "/masters/accounts", description: "Reference lists used across the workspace." },
  { key: "overview", label: "Overview", href: "/overview", description: "Track active journeys across all points." },
  { key: "start", label: "Start Point", href: "/start", description: "Where a load leaves from." },
  { key: "transfer", label: "Transfer Point", href: "/transfer", description: "Where a load changes hands." },
  { key: "final", label: "Final Point", href: "/final", description: "Where a load arrives." },
  { key: "users", label: "Users & Roles", href: "/admin/users", description: "Accounts and the pages each role can open." },
] as const;

export type AppPageKey = (typeof appPages)[number]["key"];

export function landingPath(pages: string[]) {
  return appPages.find((page) => pages.includes(page.key))?.href ?? "/account";
}

export function pageLabel(key: string) {
  return appPages.find((page) => page.key === key)?.label ?? key;
}
