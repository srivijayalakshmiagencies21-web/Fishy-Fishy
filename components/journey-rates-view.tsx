"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { saveJourneyRateLine } from "@/app/(workspace)/journey-rates/actions";
import {
  computeLineAmount,
  journeyRateStorageKey,
  parseChargeAmount,
  supplierAdditionalChargeKey,
  transporterAdditionalChargeKey,
  type JourneyRateRecord,
  type JourneyRateSupplierLine,
  type JourneyRateTransporterLine,
} from "@/lib/journey-rates";
import { formatAmount } from "@/lib/transactions";

const rateInputClass =
  "input-field !h-[32px] sm:!h-[36px] !min-h-[32px] sm:!min-h-[36px] !w-[4.75rem] sm:!w-[5.25rem] !py-0.5 !px-2 tabular-nums text-xs sm:text-sm font-semibold text-center rounded-lg bg-white";

function groupByLabel<T>(items: T[], label: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const name = label(item).trim() || "Unknown";
    const key = name.toLowerCase();
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, rows]) => ({
      title: label(rows[0]!).trim() || "Unknown",
      rows,
    }));
}

function SavedRateInput({
  journeyId,
  lineKey,
  value,
  onValueChange,
  ariaLabel,
}: {
  journeyId: string;
  lineKey: string;
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
}) {
  const lastSavedRef = useRef(value.trim());
  const [, startSave] = useTransition();

  function saveIfChanged() {
    const next = value.trim();
    if (next === lastSavedRef.current) return;
    lastSavedRef.current = next;
    const formData = new FormData();
    formData.set("journey_id", journeyId);
    formData.set("line_key", lineKey);
    formData.set("rate", next);
    startSave(async () => {
      const result = await saveJourneyRateLine(null, formData);
      if (result?.error) lastSavedRef.current = "\u0000";
    });
  }

  return (
    <form
      className="inline-flex items-center"
      onSubmit={(event) => {
        event.preventDefault();
        saveIfChanged();
      }}
    >
      <input
        name="rate"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0"
        aria-label={ariaLabel}
        value={value}
        className={rateInputClass}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={saveIfChanged}
      />
    </form>
  );
}

function RateLineInput({
  journeyId,
  lineKey,
  rateText,
  onRateTextChange,
}: {
  journeyId: string;
  lineKey: string;
  rateText: string;
  onRateTextChange: (value: string) => void;
}) {
  return (
    <SavedRateInput
      journeyId={journeyId}
      lineKey={lineKey}
      value={rateText}
      onValueChange={onRateTextChange}
      ariaLabel="Rate"
    />
  );
}

function supplierGroupTotal(
  journeyId: string,
  rows: JourneyRateSupplierLine[],
  ratesByLine: Record<string, string>,
) {
  return rows.reduce((sum, line) => {
    const key = journeyRateStorageKey(journeyId, line.lineKey);
    return sum + (computeLineAmount(line.quantity, ratesByLine[key] ?? "") ?? 0);
  }, 0);
}

function transporterGroupTotal(
  journeyId: string,
  rows: JourneyRateTransporterLine[],
  ratesByLine: Record<string, string>,
) {
  return rows.reduce((sum, line) => {
    const key = journeyRateStorageKey(journeyId, line.lineKey);
    return sum + (computeLineAmount(line.kilometers, ratesByLine[key] ?? "") ?? 0);
  }, 0);
}

function AdditionalChargeInput({
  journeyId,
  lineKey,
  chargeText,
  onChargeTextChange,
}: {
  journeyId: string;
  lineKey: string;
  chargeText: string;
  onChargeTextChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-semibold text-slate-500">₹</span>
      <SavedRateInput
        journeyId={journeyId}
        lineKey={lineKey}
        value={chargeText}
        onValueChange={onChargeTextChange}
        ariaLabel="Additional charge"
      />
    </div>
  );
}

function PartyDetailCard({
  title,
  linesTotal,
  finalTotal,
  journeyId,
  additionalLineKey,
  additionalChargeText,
  onAdditionalChargeChange,
  accent = "brand",
  children,
}: {
  title: string;
  linesTotal: number;
  finalTotal: number;
  journeyId: string;
  additionalLineKey: string;
  additionalChargeText: string;
  onAdditionalChargeChange: (value: string) => void;
  accent?: "brand" | "rose" | "amber";
  children: ReactNode;
}) {
  const isRose = accent === "rose";
  const isAmber = accent === "amber";

  return (
    <div
      className={`overflow-hidden rounded-2xl shadow-xs ${
        isRose
          ? "border border-rose-200 bg-white"
          : isAmber
            ? "border border-amber-200 bg-white"
            : "border border-line bg-white"
      }`}
    >
      {/* Premium Header */}
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 ${
          isRose
            ? "border-b border-rose-200 bg-rose-50/70"
            : isAmber
              ? "border-b border-amber-200 bg-amber-50/70"
              : "border-b border-line bg-slate-50/90"
        }`}
      >
        <h4
          className={`text-sm sm:text-base font-bold truncate min-w-0 ${
            isRose
              ? "text-rose-950"
              : isAmber
                ? "text-amber-950"
                : "text-blue-dark"
          }`}
        >
          {title}
        </h4>
        <div
          className={`shrink-0 rounded-xl px-2.5 py-1 text-xs sm:text-sm font-extrabold tabular-nums shadow-2xs ${
            isRose
              ? "bg-rose-100 border border-rose-300 text-rose-900"
              : isAmber
                ? "bg-amber-100 border border-amber-300 text-amber-900"
                : "bg-blue-soft border border-[var(--brand)]/15 text-blue-dark"
          }`}
        >
          {formatAmount(finalTotal)}
        </div>
      </div>

      {/* Main Content (Responsive non-scrollable view) */}
      <div className="p-3 sm:p-4">{children}</div>

      {/* Financial Summary Footer */}
      <div
        className={`px-3.5 py-3 sm:px-4 space-y-2.5 ${
          isRose
            ? "border-t border-rose-200 bg-rose-50/30"
            : isAmber
              ? "border-t border-amber-200 bg-amber-50/30"
              : "border-t border-line bg-[var(--page)]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted font-medium">Total after rates:</span>
            <span
              className={`tabular-nums font-bold ${
                isRose
                  ? "text-rose-950"
                  : isAmber
                    ? "text-amber-950"
                    : "text-slate-800"
              }`}
            >
              {formatAmount(linesTotal)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`font-medium ${
                isRose
                  ? "text-rose-700"
                  : isAmber
                    ? "text-amber-800"
                    : "text-slate-600"
              }`}
            >
              Additional charge:
            </span>
            <AdditionalChargeInput
              journeyId={journeyId}
              lineKey={additionalLineKey}
              chargeText={additionalChargeText}
              onChargeTextChange={onAdditionalChargeChange}
            />
          </div>
        </div>
        <div
          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
            isRose
              ? "bg-rose-100/70 border border-rose-200 text-rose-950"
              : isAmber
                ? "bg-amber-100/70 border border-amber-200 text-amber-950"
                : "bg-blue-soft/50 border border-[var(--brand)]/10 text-blue-dark"
          }`}
        >
          <span
            className={`text-xs sm:text-sm font-bold ${
              isRose
                ? "text-rose-900"
                : isAmber
                  ? "text-amber-900"
                  : "text-slate-700"
            }`}
          >
            Grand Total
          </span>
          <span className="text-sm sm:text-base font-extrabold tabular-nums">
            {formatAmount(finalTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function partyCardTotals(
  linesTotal: number,
  journeyId: string,
  additionalLineKey: string,
  ratesByLine: Record<string, string>,
) {
  const storageKey = journeyRateStorageKey(journeyId, additionalLineKey);
  const additional = parseChargeAmount(ratesByLine[storageKey] ?? "");
  return { linesTotal, finalTotal: linesTotal + additional, additionalChargeText: ratesByLine[storageKey] ?? "" };
}

function CarouselArrow({
  direction,
  onClick,
  label,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-blue-dark shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        {direction === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

function PartyCardCarousel<T extends { title: string }>({
  groups,
  carouselKey,
  renderGroup,
}: {
  groups: T[];
  carouselKey: string;
  renderGroup: (group: T) => ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const total = groups.length;
  const resetKey = `${carouselKey}:${total}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setIndex(0);
  }
  const safeIndex = total === 0 ? 0 : Math.min(index, total - 1);

  if (total === 0) return null;

  const group = groups[safeIndex]!;
  const showNav = total > 1;

  if (!showNav) {
    return <div className="mx-auto w-full max-w-xl">{renderGroup(group)}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-2.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-bold text-slate-500 tabular-nums">
          {safeIndex + 1} of {total} · <span className="text-slate-800">{group.title}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <CarouselArrow
            direction="prev"
            label="Previous"
            onClick={() => setIndex((current) => (current - 1 + total) % total)}
          />
          <CarouselArrow
            direction="next"
            label="Next"
            onClick={() => setIndex((current) => (current + 1) % total)}
          />
        </div>
      </div>
      <div className="min-w-0 w-full">{renderGroup(group)}</div>
    </div>
  );
}

type RateLineBindings = {
  rateTextFor: (journeyId: string, lineKey: string) => string;
  onRateTextChange: (journeyId: string, lineKey: string, value: string) => void;
};

function JourneyRateCard({
  record,
  ratesByLine,
  onRateChange,
  isExpanded,
  onToggle,
}: {
  record: JourneyRateRecord;
  ratesByLine: Record<string, string>;
  onRateChange: (storageKey: string, value: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const supplierGroups = groupByLabel(record.suppliers, (line) => line.supplier);
  const nonLocalGroups = groupByLabel(record.nonLocalTransporters, (line) => line.transporter);
  const localGroups = groupByLabel(record.localTransporters, (line) => line.transporter);

  const transporterCount = nonLocalGroups.length + localGroups.length;

  const supplierTotal = supplierGroups.reduce((acc, g) => {
    const linesTotal = supplierGroupTotal(record.journeyId, g.rows, ratesByLine);
    const additional = parseChargeAmount(
      ratesByLine[journeyRateStorageKey(record.journeyId, supplierAdditionalChargeKey(g.title))] ?? ""
    );
    return acc + linesTotal + additional;
  }, 0);

  const nonLocalTotal = nonLocalGroups.reduce((acc, g) => {
    const linesTotal = transporterGroupTotal(record.journeyId, g.rows, ratesByLine);
    const additional = parseChargeAmount(
      ratesByLine[journeyRateStorageKey(record.journeyId, transporterAdditionalChargeKey("non-local", g.title))] ?? ""
    );
    return acc + linesTotal + additional;
  }, 0);

  const localTotal = localGroups.reduce((acc, g) => {
    const linesTotal = transporterGroupTotal(record.journeyId, g.rows, ratesByLine);
    const additional = parseChargeAmount(
      ratesByLine[journeyRateStorageKey(record.journeyId, transporterAdditionalChargeKey("local", g.title))] ?? ""
    );
    return acc + linesTotal + additional;
  }, 0);

  const transporterTotal = nonLocalTotal + localTotal;
  const journeyTotal = supplierTotal + transporterTotal;

  const lineRates: RateLineBindings = {
    rateTextFor: (journeyId, lineKey) => ratesByLine[journeyRateStorageKey(journeyId, lineKey)] ?? "",
    onRateTextChange: (journeyId, lineKey, value) =>
      onRateChange(journeyRateStorageKey(journeyId, lineKey), value),
  };

  return (
    <article className="surface overflow-hidden rounded-2xl border border-line transition-all duration-200">
      <header
        className={`bg-[var(--page)] transition-colors hover:bg-slate-100/70 ${
          isExpanded ? "border-b border-line" : ""
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="flex w-full flex-col gap-2 p-3 sm:p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue cursor-pointer"
        >
          {/* Top Line: Title + Amount on Left, Arrow Mark on Right */}
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base font-bold text-blue-dark">
                Journey #{record.journeyNumber}
              </h2>

              <span className="inline-flex items-center rounded-lg bg-blue-soft border border-blue/25 px-2.5 py-0.5 text-xs font-extrabold text-blue-dark tabular-nums shrink-0">
                {formatAmount(journeyTotal)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-muted hidden sm:inline">
                {isExpanded ? "Collapse" : "Expand"}
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-white text-blue-dark transition-transform duration-200 shadow-2xs ${
                  isExpanded ? "rotate-180 bg-blue-soft text-blue" : ""
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Second Line: Supplier and Transporter Badges Side by Side (No wrapping) */}
          {supplierGroups.length > 0 || transporterCount > 0 ? (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
              {supplierGroups.length > 0 ? (
                <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-xs font-semibold text-rose-800">
                  <span>
                    {supplierGroups.length} {supplierGroups.length === 1 ? "Supplier" : "Suppliers"}
                  </span>
                  <span className="font-bold text-rose-950 tabular-nums">
                    · {formatAmount(supplierTotal)}
                  </span>
                </span>
              ) : null}

              {transporterCount > 0 ? (
                <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 sm:px-2 py-0.5 text-[10.5px] sm:text-xs font-semibold text-amber-900">
                  <span>
                    {transporterCount} {transporterCount === 1 ? "Transporter" : "Transporters"}
                  </span>
                  <span className="font-bold text-amber-950 tabular-nums">
                    · {formatAmount(transporterTotal)}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </button>
      </header>

      {isExpanded ? (
        <div className="space-y-6 p-4">
        <section className="space-y-3">
          <h3 className="text-center text-xs font-bold uppercase tracking-wider text-blue-dark sm:text-left">
            Supplier details (start point)
          </h3>
          {supplierGroups.length === 0 ? (
            <p className="text-sm text-muted">No start-point quantities recorded.</p>
          ) : (
            <PartyCardCarousel
              carouselKey={`${record.journeyId}-suppliers-${supplierGroups.length}`}
              groups={supplierGroups}
              renderGroup={(group) => {
                const linesTotal = supplierGroupTotal(record.journeyId, group.rows, ratesByLine);
                const additionalLineKey = supplierAdditionalChargeKey(group.title);
                const totals = partyCardTotals(linesTotal, record.journeyId, additionalLineKey, ratesByLine);
                return (
                <PartyDetailCard
                  title={group.title}
                  linesTotal={totals.linesTotal}
                  finalTotal={totals.finalTotal}
                  journeyId={record.journeyId}
                  additionalLineKey={additionalLineKey}
                  additionalChargeText={totals.additionalChargeText}
                  onAdditionalChargeChange={(value) =>
                    onRateChange(journeyRateStorageKey(record.journeyId, additionalLineKey), value)
                  }
                  accent="rose"
                >
                  {/* Mobile View: Luxury Item Cards (< sm) */}
                  <div className="space-y-2.5 sm:hidden">
                    {group.rows.map((line: JourneyRateSupplierLine) => {
                      const amount = computeLineAmount(
                        line.quantity,
                        lineRates.rateTextFor(record.journeyId, line.lineKey)
                      );
                      return (
                        <div
                          key={line.lineKey}
                          className="bg-rose-50 border border-rose-200 rounded-2xl p-3 sm:p-4 transition-all hover:bg-rose-50/80 shadow-2xs"
                        >
                          {/* Top Row: Fish Type + Seed Size Badge (left) & Calculated Amount (right) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-900 text-sm truncate">
                                {line.fishType}
                              </span>
                              {line.seedSize ? (
                                <span className="shrink-0 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                  {line.seedSize}
                                </span>
                              ) : null}
                            </div>
                            <span className="font-extrabold tabular-nums text-rose-900 text-sm shrink-0">
                              {amount != null ? formatAmount(amount) : "—"}
                            </span>
                          </div>

                          {/* Bottom Row: Quantity (left) & Interactive Rate Input (right) with labels centered */}
                          <div className="mt-2.5 flex items-start justify-between gap-2 border-t border-rose-200/70 pt-2 px-1 text-xs">
                            <div className="flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                                Qty
                              </span>
                              <div className="mt-1 flex h-[32px] sm:h-[36px] items-center justify-center">
                                <span className="text-sm font-bold text-slate-800 tabular-nums">
                                  {line.quantity != null ? Number(line.quantity).toLocaleString() : "—"}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center text-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                                Rate
                              </span>
                              <div className="mt-1 flex h-[32px] sm:h-[36px] items-center gap-1">
                                <span className="text-xs font-semibold text-rose-600">₹</span>
                                <RateLineInput
                                  journeyId={record.journeyId}
                                  lineKey={line.lineKey}
                                  rateText={lineRates.rateTextFor(record.journeyId, line.lineKey)}
                                  onRateTextChange={(value) =>
                                    lineRates.onRateTextChange(record.journeyId, line.lineKey, value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop View: Spacious Non-Scrolling Table (sm and up) */}
                  <div className="hidden sm:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-rose-200 text-xs font-semibold text-rose-900">
                          <th className="pb-2 pl-2">Fish type</th>
                          <th className="pb-2 px-2">Seed size</th>
                          <th className="pb-2 px-2">Quantity</th>
                          <th className="pb-2 px-2">Rate (₹)</th>
                          <th className="pb-2 pr-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {group.rows.map((line: JourneyRateSupplierLine) => {
                          const amount = computeLineAmount(
                            line.quantity,
                            lineRates.rateTextFor(record.journeyId, line.lineKey)
                          );
                          return (
                            <tr key={line.lineKey} className="hover:bg-rose-50/50 transition-colors">
                              <td className="py-2.5 pl-2 font-semibold text-slate-800">{line.fishType}</td>
                              <td className="py-2.5 px-2 text-slate-600">
                                {line.seedSize ? (
                                  <span className="rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[11px] font-bold text-rose-700">
                                    {line.seedSize}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-2 tabular-nums font-medium text-slate-700">
                                {line.quantity != null ? Number(line.quantity).toLocaleString() : "—"}
                              </td>
                              <td className="py-2.5 px-2">
                                <RateLineInput
                                  journeyId={record.journeyId}
                                  lineKey={line.lineKey}
                                  rateText={lineRates.rateTextFor(record.journeyId, line.lineKey)}
                                  onRateTextChange={(value) =>
                                    lineRates.onRateTextChange(record.journeyId, line.lineKey, value)
                                  }
                                />
                              </td>
                              <td className="py-2.5 pr-2 text-right tabular-nums font-extrabold text-rose-900">
                                {amount != null ? formatAmount(amount) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </PartyDetailCard>
                );
              }}
            />
          )}
        </section>

        <TransporterRateSection
          title="Transporter · Non-Local"
          transporterScope="non-local"
          sectionKey={`${record.journeyId}-non-local`}
          groups={nonLocalGroups}
          journeyId={record.journeyId}
          ratesByLine={ratesByLine}
          onRateChange={onRateChange}
          lineRates={lineRates}
          empty="No non-local transporters on this journey."
        />
        <TransporterRateSection
          title="Transporter · Local"
          transporterScope="local"
          sectionKey={`${record.journeyId}-local`}
          groups={localGroups}
          journeyId={record.journeyId}
          ratesByLine={ratesByLine}
          onRateChange={onRateChange}
          lineRates={lineRates}
          empty="No local transporters on this journey."
        />
      </div>
      ) : null}
    </article>
  );
}

function TransporterRateSection({
  title,
  transporterScope,
  sectionKey,
  groups,
  journeyId,
  ratesByLine,
  onRateChange,
  lineRates,
  empty,
}: {
  title: string;
  transporterScope: "local" | "non-local";
  sectionKey: string;
  groups: { title: string; rows: JourneyRateTransporterLine[] }[];
  journeyId: string;
  ratesByLine: Record<string, string>;
  onRateChange: (storageKey: string, value: string) => void;
  lineRates: RateLineBindings;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-center text-xs font-bold uppercase tracking-wider text-blue-dark sm:text-left">{title}</h3>
      {groups.length === 0 ? (
        <p className="text-center text-sm text-muted sm:text-left">{empty}</p>
      ) : (
        <PartyCardCarousel
          carouselKey={`${sectionKey}-${groups.length}`}
          groups={groups}
          renderGroup={(group) => {
            const linesTotal = transporterGroupTotal(journeyId, group.rows, ratesByLine);
            const additionalLineKey = transporterAdditionalChargeKey(transporterScope, group.title);
            const totals = partyCardTotals(linesTotal, journeyId, additionalLineKey, ratesByLine);
            return (
            <PartyDetailCard
              title={group.title}
              linesTotal={totals.linesTotal}
              finalTotal={totals.finalTotal}
              journeyId={journeyId}
              additionalLineKey={additionalLineKey}
              additionalChargeText={totals.additionalChargeText}
              onAdditionalChargeChange={(value) =>
                onRateChange(journeyRateStorageKey(journeyId, additionalLineKey), value)
              }
              accent="amber"
            >
              {/* Mobile View: Luxury Item Cards (< sm) */}
              <div className="space-y-2.5 sm:hidden">
                {group.rows.map((line) => {
                  const amount = computeLineAmount(
                    line.kilometers,
                    lineRates.rateTextFor(journeyId, line.lineKey)
                  );
                  return (
                    <div
                      key={line.lineKey}
                      className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:p-4 transition-all hover:bg-amber-50/80 shadow-2xs"
                    >
                      {/* Top Row: Vehicle Number (left) & Calculated Amount (right) */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {line.vehicleNumber}
                        </span>
                        <span className="font-extrabold tabular-nums text-amber-900 text-sm shrink-0">
                          {amount != null ? formatAmount(amount) : "—"}
                        </span>
                      </div>

                      {/* Bottom Row: Kilometres (left) & Interactive Rate Input (right) with labels centered */}
                      <div className="mt-2.5 flex items-start justify-between gap-2 border-t border-amber-200/70 pt-2 px-1 text-xs">
                        <div className="flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                            Distance
                          </span>
                          <div className="mt-1 flex h-[32px] sm:h-[36px] items-center justify-center">
                            <span className="text-sm font-bold text-slate-800 tabular-nums">
                              {line.kilometers != null ? `${Number(line.kilometers).toLocaleString()} km` : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                            Rate/km
                          </span>
                          <div className="mt-1 flex h-[32px] sm:h-[36px] items-center gap-1">
                            <span className="text-xs font-semibold text-amber-700">₹</span>
                            <RateLineInput
                              journeyId={journeyId}
                              lineKey={line.lineKey}
                              rateText={lineRates.rateTextFor(journeyId, line.lineKey)}
                              onRateTextChange={(value) =>
                                lineRates.onRateTextChange(journeyId, line.lineKey, value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Spacious Non-Scrolling Table (sm and up) */}
              <div className="hidden sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-amber-200 text-xs font-semibold text-amber-900">
                      <th className="pb-2 pl-2">Vehicle</th>
                      <th className="pb-2 px-2">Kilometres</th>
                      <th className="pb-2 px-2">Rate (₹/km)</th>
                      <th className="pb-2 pr-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {group.rows.map((line) => {
                      const amount = computeLineAmount(
                        line.kilometers,
                        lineRates.rateTextFor(journeyId, line.lineKey)
                      );
                      return (
                        <tr key={line.lineKey} className="hover:bg-amber-50/50 transition-colors">
                          <td className="py-2.5 pl-2 font-semibold text-slate-800">{line.vehicleNumber}</td>
                          <td className="py-2.5 px-2 tabular-nums font-medium text-slate-700">
                            {line.kilometers != null ? `${Number(line.kilometers).toLocaleString()} km` : "—"}
                          </td>
                          <td className="py-2.5 px-2">
                            <RateLineInput
                              journeyId={journeyId}
                              lineKey={line.lineKey}
                              rateText={lineRates.rateTextFor(journeyId, line.lineKey)}
                              onRateTextChange={(value) =>
                                lineRates.onRateTextChange(journeyId, line.lineKey, value)
                              }
                            />
                          </td>
                          <td className="py-2.5 pr-2 text-right tabular-nums font-extrabold text-amber-900">
                            {amount != null ? formatAmount(amount) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </PartyDetailCard>
            );
          }}
        />
      )}
    </section>
  );
}

export function JourneyRatesView({
  rows,
  initialRateTexts,
  error,
}: {
  rows: JourneyRateRecord[];
  initialRateTexts: Record<string, string>;
  error: string | null;
}) {
  const [ratesByLine, setRatesByLine] = useState(initialRateTexts);
  const [syncedInitial, setSyncedInitial] = useState(initialRateTexts);
  const [expandedJourneyIds, setExpandedJourneyIds] = useState<Record<string, boolean>>({});

  if (syncedInitial !== initialRateTexts) {
    setSyncedInitial(initialRateTexts);
    setRatesByLine((current) => ({ ...initialRateTexts, ...current }));
  }

  function setLineRate(storageKey: string, value: string) {
    setRatesByLine((current) => ({ ...current, [storageKey]: value }));
  }

  function toggleJourney(journeyId: string) {
    setExpandedJourneyIds((prev) => ({
      ...prev,
      [journeyId]: !prev[journeyId],
    }));
  }

  const allExpanded = rows.length > 0 && rows.every((r) => expandedJourneyIds[r.journeyId]);

  function toggleAll() {
    if (allExpanded) {
      setExpandedJourneyIds({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of rows) next[r.journeyId] = true;
      setExpandedJourneyIds(next);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm font-medium text-blue-dark">
        {error}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm text-muted">
        No closed journeys yet. Rates appear here after a journey is completed at Final Point.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length > 1 ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs font-semibold text-muted">
            {rows.length} completed journeys
          </p>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-bold text-blue hover:text-blue-dark transition-colors cursor-pointer"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      ) : null}

      {rows.map((record) => (
        <JourneyRateCard
          key={record.journeyId}
          record={record}
          ratesByLine={ratesByLine}
          onRateChange={setLineRate}
          isExpanded={Boolean(expandedJourneyIds[record.journeyId])}
          onToggle={() => toggleJourney(record.journeyId)}
        />
      ))}
    </div>
  );
}
