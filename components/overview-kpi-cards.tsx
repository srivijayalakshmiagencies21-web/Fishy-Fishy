"use client";

import { ReactNode } from "react";

export type OverviewKpiMetric = {
  label: string;
  value: string | null;
};

export type OverviewKpiItem = {
  id: string;
  title: string;
  subtitle?: string;
  value?: string | number | null;
  metrics?: OverviewKpiMetric[];
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  accent: "blue" | "emerald" | "purple" | "amber" | "rose" | "pink";
  icon?: ReactNode;
};

export const overviewKpiDefaults: OverviewKpiItem[] = [
  {
    id: "sales-value",
    title: "Sales View",
    subtitle: "Pending formula",
    value: null,
    accent: "emerald",
  },
  {
    id: "seed-vendor-payable",
    title: "Seed Vendor Payable",
    subtitle: "Pending formula",
    value: null,
    accent: "pink",
  },
  {
    id: "transport-vendor-payable",
    title: "Transport Vendor Payable",
    subtitle: "Pending formula",
    value: null,
    accent: "amber",
  },
  {
    id: "pc",
    title: "PC",
    subtitle: "Pending formula",
    value: null,
    accent: "purple",
  },
  {
    id: "expenses",
    title: "Expenses",
    subtitle: "Pending formula",
    value: null,
    accent: "blue",
  },
];

const accentStyles = {
  emerald: {
    border: "border-emerald-200/70 hover:border-emerald-300",
    ring: "ring-emerald-500/25",
    iconBg: "bg-emerald-100 text-emerald-700",
    strip: "border-emerald-100 bg-emerald-50/90",
    stripLabel: "text-emerald-800/70",
  },
  pink: {
    border: "border-pink-200/70 hover:border-pink-300",
    ring: "ring-pink-500/25",
    iconBg: "bg-pink-100 text-pink-700",
    strip: "border-pink-100 bg-pink-50/90",
    stripLabel: "text-pink-900/70",
  },
  rose: {
    border: "border-rose-200/70 hover:border-rose-300",
    ring: "ring-rose-500/25",
    iconBg: "bg-rose-100 text-rose-700",
    strip: "border-rose-100 bg-rose-50/90",
    stripLabel: "text-rose-900/70",
  },
  blue: {
    border: "border-blue-200/70 hover:border-blue-300",
    ring: "ring-blue-500/25",
    iconBg: "bg-blue-100 text-blue-700",
    strip: "border-blue-100 bg-blue-50/90",
    stripLabel: "text-blue-900/70",
  },
  amber: {
    border: "border-amber-200/70 hover:border-amber-300",
    ring: "ring-amber-500/25",
    iconBg: "bg-amber-100 text-amber-800",
    strip: "border-amber-100 bg-amber-50/90",
    stripLabel: "text-amber-950/70",
  },
  purple: {
    border: "border-purple-200/70 hover:border-purple-300",
    ring: "ring-purple-500/25",
    iconBg: "bg-purple-100 text-purple-700",
    strip: "border-purple-100 bg-purple-50/90",
    stripLabel: "text-purple-900/70",
  },
};

const kpiIconClass = "h-5 w-5 shrink-0";

function KpiPlaceholderIcon({ id }: { id: string }) {
  if (id === "sales-value") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={kpiIconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3v18h18" />
        <path d="m7 14 4-4 3 3 5-6" />
        <path d="M14 7h5v5" />
      </svg>
    );
  }
  if (id === "seed-vendor-payable") {
    return (
      <svg viewBox="0 0 24 24" className={kpiIconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (id === "transport-vendor-payable") {
    return (
      <svg viewBox="0 0 24 24" className={kpiIconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    );
  }
  if (id === "pc") {
    return (
      <svg
        viewBox="0 0 12 19"
        className={kpiIconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1.5 2h9" />
        <path d="M1.5 5.75h9" />
        <path d="m1.5 9.5 6.375 6" />
        <path d="M1.5 9.5h2.25" />
        <path d="M3.75 9.5c5 0 5-7.5 0-7.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={kpiIconClass} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function KpiCardShell({
  interactive,
  selected,
  style,
  onSelect,
  className,
  children,
}: {
  interactive: boolean;
  selected: boolean;
  style: (typeof accentStyles)[keyof typeof accentStyles];
  onSelect?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={`group relative h-full w-full overflow-hidden rounded-xl border bg-white text-left shadow-xs transition-all duration-200 ${
        interactive
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          : ""
      } ${selected ? `ring-2 ring-blue shadow-md ${style.ring}` : ""} ${style.border} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function CompactKpiCard({
  kpi,
  selected,
  onSelect,
}: {
  kpi: OverviewKpiItem;
  selected: boolean;
  onSelect?: () => void;
}) {
  const style = accentStyles[kpi.accent] ?? accentStyles.blue;
  const interactive = Boolean(onSelect);
  const metrics = kpi.metrics ?? [];

  return (
    <KpiCardShell interactive={interactive} selected={selected} style={style} onSelect={onSelect}>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${style.iconBg}`}
          >
            {kpi.icon ?? <KpiPlaceholderIcon id={kpi.id} />}
          </div>
          <p className="min-w-0 flex-1 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-600 sm:text-[11px] sm:leading-snug sm:text-xs">
            {kpi.title}
          </p>
        </div>
        {kpi.value != null ? (
          <p className="px-3 pb-2 text-left text-base font-extrabold leading-tight tabular-nums text-slate-900 sm:text-lg">
            {kpi.value}
          </p>
        ) : (
          <p className="px-3 pb-2 text-left text-base font-bold tabular-nums text-slate-300">—</p>
        )}

        {metrics.length > 0 ? (
          <dl
            className={`mt-0.5 grid grid-cols-2 gap-px border-t ${style.strip}`}
          >
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className={`px-2.5 py-2 ${index === 0 ? "border-r border-inherit" : ""}`}
              >
                <dt className={`text-[9px] font-bold uppercase leading-snug sm:text-[10px] ${style.stripLabel}`}>
                  {metric.label}
                </dt>
                <dd className="mt-0.5 text-sm font-extrabold tabular-nums text-slate-900">
                  {metric.value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </KpiCardShell>
  );
}

function SalesKpiCard({
  kpi,
  selected,
  onSelect,
}: {
  kpi: OverviewKpiItem;
  selected: boolean;
  onSelect?: () => void;
}) {
  const style = accentStyles[kpi.accent] ?? accentStyles.blue;
  const interactive = Boolean(onSelect);

  return (
    <KpiCardShell
      interactive={interactive}
      selected={selected}
      style={style}
      onSelect={onSelect}
      className="p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wider text-slate-500">{kpi.title}</p>
          {kpi.subtitle ? <p className="mt-0.5 text-xs text-muted">{kpi.subtitle}</p> : null}
          {kpi.value != null ? (
            <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {kpi.value}
            </p>
          ) : (
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-300">—</p>
          )}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
        >
          {kpi.icon ?? <KpiPlaceholderIcon id={kpi.id} />}
        </div>
      </div>
    </KpiCardShell>
  );
}

function KpiCard({
  kpi,
  slot,
  selected,
  onSelect,
}: {
  kpi: OverviewKpiItem;
  slot: number;
  selected: boolean;
  onSelect?: () => void;
}) {
  if (slot > 1) {
    return <CompactKpiCard kpi={kpi} selected={selected} onSelect={onSelect} />;
  }
  return <SalesKpiCard kpi={kpi} selected={selected} onSelect={onSelect} />;
}

export function OverviewKpiCards({
  items = overviewKpiDefaults,
  selectedId,
  focused = false,
  onSelect,
}: {
  items?: OverviewKpiItem[];
  selectedId?: string | null;
  /** When true, a single KPI is shown above its ledger (full-width layout). */
  focused?: boolean;
  onSelect?: (id: string) => void;
}) {
  if (items.length === 0) return null;

  if (focused && items.length === 1) {
    const kpi = items[0]!;
    const slot = kpi.id === "sales-value" ? 1 : 2;
    return (
      <section className="max-w-2xl">
        <KpiCard
          kpi={kpi}
          slot={slot}
          selected
          onSelect={undefined}
        />
      </section>
    );
  }

  const salesKpi = items.find((item) => item.id === "sales-value") ?? items[0];
  const otherKpis = items.filter((item) => item !== salesKpi);

  return (
    <section className="grid grid-cols-2 items-stretch gap-3 sm:gap-4">
      {salesKpi ? (
        <div key={salesKpi.id} className="col-span-2">
          <KpiCard
            kpi={salesKpi}
            slot={1}
            selected={selectedId === salesKpi.id}
            onSelect={onSelect ? () => onSelect(salesKpi.id) : undefined}
          />
        </div>
      ) : null}
      {otherKpis.map((kpi, idx) => (
        <KpiCard
          key={kpi.id}
          kpi={kpi}
          slot={idx + 2}
          selected={selectedId === kpi.id}
          onSelect={onSelect ? () => onSelect(kpi.id) : undefined}
        />
      ))}
    </section>
  );
}
