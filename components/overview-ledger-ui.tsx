import type { ReactNode } from "react";

export type OverviewLedgerAccent = "emerald" | "pink" | "amber" | "purple" | "blue";

const ledgerThemes: Record<
  OverviewLedgerAccent,
  {
    sectionBorder: string;
    infoBtn: string;
    thead: string;
    tfoot: string;
    rowHover: string;
    body: string;
    mobileTotals: string;
    mobileTotalsHeading: string;
    mobileTotalsLabel: string;
    mobileTotalsValue: string;
    tbodyDivide: string;
  }
> = {
  emerald: {
    sectionBorder: "border-emerald-200/70",
    infoBtn: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200/90",
    thead: "border-emerald-100 bg-emerald-50/70 text-emerald-900/85",
    tfoot: "border-emerald-100 bg-emerald-50/90 text-emerald-950",
    rowHover: "hover:bg-emerald-50/50",
    body: "bg-emerald-50/20",
    mobileTotals: "border-emerald-200/80 bg-emerald-50/60",
    mobileTotalsHeading: "text-emerald-900",
    mobileTotalsLabel: "text-emerald-900/80",
    mobileTotalsValue: "text-emerald-950",
    tbodyDivide: "divide-emerald-100/70",
  },
  pink: {
    sectionBorder: "border-pink-200/70",
    infoBtn: "bg-pink-100 text-pink-800 hover:bg-pink-200/90",
    thead: "border-pink-100 bg-pink-50/70 text-pink-900/85",
    tfoot: "border-pink-100 bg-pink-50/90 text-pink-950",
    rowHover: "hover:bg-pink-50/50",
    body: "bg-pink-50/20",
    mobileTotals: "border-pink-200/80 bg-pink-50/60",
    mobileTotalsHeading: "text-pink-900",
    mobileTotalsLabel: "text-pink-900/80",
    mobileTotalsValue: "text-pink-950",
    tbodyDivide: "divide-pink-100/70",
  },
  amber: {
    sectionBorder: "border-amber-200/70",
    infoBtn: "bg-amber-100 text-amber-900 hover:bg-amber-200/90",
    thead: "border-amber-100 bg-amber-50/70 text-amber-950/85",
    tfoot: "border-amber-100 bg-amber-50/90 text-amber-950",
    rowHover: "hover:bg-amber-50/50",
    body: "bg-amber-50/20",
    mobileTotals: "border-amber-200/80 bg-amber-50/60",
    mobileTotalsHeading: "text-amber-900",
    mobileTotalsLabel: "text-amber-900/80",
    mobileTotalsValue: "text-amber-950",
    tbodyDivide: "divide-amber-100/70",
  },
  purple: {
    sectionBorder: "border-purple-200/70",
    infoBtn: "bg-purple-100 text-purple-800 hover:bg-purple-200/90",
    thead: "border-purple-100 bg-purple-50/70 text-purple-900/85",
    tfoot: "border-purple-100 bg-purple-50/90 text-purple-950",
    rowHover: "hover:bg-purple-50/50",
    body: "bg-purple-50/20",
    mobileTotals: "border-purple-200/80 bg-purple-50/60",
    mobileTotalsHeading: "text-purple-900",
    mobileTotalsLabel: "text-purple-900/80",
    mobileTotalsValue: "text-purple-950",
    tbodyDivide: "divide-purple-100/70",
  },
  blue: {
    sectionBorder: "border-blue-200/70",
    infoBtn: "bg-blue-100 text-blue-800 hover:bg-blue-200/90",
    thead: "border-blue-100 bg-blue-50/70 text-blue-900/85",
    tfoot: "border-blue-100 bg-blue-50/90 text-blue-950",
    rowHover: "hover:bg-blue-50/50",
    body: "bg-blue-50/20",
    mobileTotals: "border-blue-200/80 bg-blue-50/60",
    mobileTotalsHeading: "text-blue-900",
    mobileTotalsLabel: "text-blue-900/80",
    mobileTotalsValue: "text-blue-950",
    tbodyDivide: "divide-blue-100/70",
  },
};

export function overviewLedgerTheme(accent: OverviewLedgerAccent) {
  return ledgerThemes[accent];
}

export function OverviewLedgerSection({
  accent,
  children,
  className = "",
}: {
  accent: OverviewLedgerAccent;
  children: ReactNode;
  className?: string;
}) {
  const theme = overviewLedgerTheme(accent);
  return (
    <section
      className={`rounded-xl border bg-white shadow-xs ${theme.sectionBorder} ${className}`}
    >
      {children}
    </section>
  );
}

export function OverviewLedgerEmpty({
  accent,
  children,
}: {
  accent: OverviewLedgerAccent;
  children: ReactNode;
}) {
  const theme = overviewLedgerTheme(accent);
  return (
    <section
      className={`rounded-xl border bg-white px-4 py-8 text-center text-sm text-muted shadow-xs ${theme.sectionBorder}`}
    >
      {children}
    </section>
  );
}

export function overviewLedgerTableHeadClass(accent: OverviewLedgerAccent) {
  const theme = overviewLedgerTheme(accent);
  return `border-b text-xs font-bold uppercase tracking-wider ${theme.thead}`;
}

export function overviewLedgerTableFootClass(accent: OverviewLedgerAccent) {
  const theme = overviewLedgerTheme(accent);
  return `border-t font-bold ${theme.tfoot}`;
}

export function overviewLedgerRowHoverClass(accent: OverviewLedgerAccent) {
  return overviewLedgerTheme(accent).rowHover;
}

export function overviewLedgerBodyClass(accent: OverviewLedgerAccent) {
  return overviewLedgerTheme(accent).body;
}

export function overviewLedgerMobileTotalsClass(accent: OverviewLedgerAccent) {
  return overviewLedgerTheme(accent);
}
