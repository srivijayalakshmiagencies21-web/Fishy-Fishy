import "server-only";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { invalidateWorkspaceData } from "@/lib/cache-tags.server";
import { FINANCIAL_YEAR_COOKIE } from "@/lib/financial-year";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * FY selection, FY setup, and govt/vendor rates feed the workspace header plus Overview,
 * Timeline, and Vendor & Govt Rates. Revalidating the root layout also purges the client
 * router cache, so already-visited pages don't show the previous FY for `staleTimes`.
 */
export function revalidateFinancialYearSelection() {
  revalidatePath("/", "layout");
}

/** FY setup or govt/vendor rate writes: also drop cached workspace data. */
export function revalidateFinancialYearViews() {
  invalidateWorkspaceData();
  revalidateFinancialYearSelection();
}

export async function setSelectedFinancialYearCookie(financialYearId: number) {
  const cookieStore = await cookies();
  cookieStore.set(FINANCIAL_YEAR_COOKIE, String(financialYearId), {
    path: "/",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
}
