/** Workspace routes that show the financial year control in the page header. */
export const FINANCIAL_YEAR_HEADER_PATHS = [
  "/overview",
  "/timeline",
  "/vendor-govt-rates",
] as const;

export function showsFinancialYearInHeader(pathname: string) {
  return (FINANCIAL_YEAR_HEADER_PATHS as readonly string[]).includes(pathname);
}
