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

const rateInputClass = "input-field !min-h-[36px] !w-[5.5rem] !py-1.5 !px-2 tabular-nums text-sm";

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
      className="inline-block"
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

function RateAmountCells({
  journeyId,
  lineKey,
  rateText,
  onRateTextChange,
  multiplier,
}: {
  journeyId: string;
  lineKey: string;
  rateText: string;
  onRateTextChange: (value: string) => void;
  multiplier: number | null;
}) {
  const amount = computeLineAmount(multiplier, rateText);

  return (
    <>
      <td className="px-2 py-2">
        <RateLineInput
          journeyId={journeyId}
          lineKey={lineKey}
          rateText={rateText}
          onRateTextChange={onRateTextChange}
        />
      </td>
      <td className="px-2 py-2 tabular-nums font-medium">{amount != null ? formatAmount(amount) : "—"}</td>
    </>
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
    <SavedRateInput
      journeyId={journeyId}
      lineKey={lineKey}
      value={chargeText}
      onValueChange={onChargeTextChange}
      ariaLabel="Additional charge"
    />
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
  children,
}: {
  title: string;
  linesTotal: number;
  finalTotal: number;
  journeyId: string;
  additionalLineKey: string;
  additionalChargeText: string;
  onAdditionalChargeChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="flex items-baseline justify-between gap-2 border-b border-line bg-blue-soft/60 px-3 py-2">
        <h4 className="text-sm font-bold text-blue-dark">{title}</h4>
        <span className="shrink-0 text-sm font-bold tabular-nums text-blue-dark">{formatAmount(finalTotal)}</span>
      </div>
      <div className="p-2">{children}</div>
      <div className="border-t border-line bg-[var(--page)] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted">Total after rates</span>
            <span className="tabular-nums font-semibold text-blue-dark">{formatAmount(linesTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-blue-dark">Additional charge</span>
            <AdditionalChargeInput
              journeyId={journeyId}
              lineKey={additionalLineKey}
              chargeText={additionalChargeText}
              onChargeTextChange={onAdditionalChargeChange}
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
          <span className="text-sm font-bold text-blue-dark">Grand total</span>
          <span className="text-sm font-bold tabular-nums text-blue-dark">{formatAmount(finalTotal)}</span>
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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-blue-dark shadow-sm hover:bg-blue-soft"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
    return <div className="mx-auto w-full max-w-md">{renderGroup(group)}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <CarouselArrow
          direction="prev"
          label="Previous"
          onClick={() => setIndex((current) => (current - 1 + total) % total)}
        />
        <div className="min-w-0 w-full max-w-md flex-1">{renderGroup(group)}</div>
        <CarouselArrow
          direction="next"
          label="Next"
          onClick={() => setIndex((current) => (current + 1) % total)}
        />
      </div>
      <p className="mt-2 text-center text-xs tabular-nums text-muted">
        {safeIndex + 1} of {total} · {group.title}
      </p>
    </div>
  );
}

type RateLineBindings = {
  rateTextFor: (journeyId: string, lineKey: string) => string;
  onRateTextChange: (journeyId: string, lineKey: string, value: string) => void;
};

function JourneyRateCard({ record, ratesByLine, onRateChange }: { record: JourneyRateRecord; ratesByLine: Record<string, string>; onRateChange: (storageKey: string, value: string) => void }) {
  const supplierGroups = groupByLabel(record.suppliers, (line) => line.supplier);
  const nonLocalGroups = groupByLabel(record.nonLocalTransporters, (line) => line.transporter);
  const localGroups = groupByLabel(record.localTransporters, (line) => line.transporter);

  const lineRates: RateLineBindings = {
    rateTextFor: (journeyId, lineKey) => ratesByLine[journeyRateStorageKey(journeyId, lineKey)] ?? "",
    onRateTextChange: (journeyId, lineKey, value) =>
      onRateChange(journeyRateStorageKey(journeyId, lineKey), value),
  };

  return (
    <article className="surface overflow-hidden">
      <header className="border-b border-line bg-[var(--page)] px-4 py-3">
        <h2 className="text-base font-bold text-blue-dark">Journey #{record.journeyNumber}</h2>
      </header>
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
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[280px] text-left text-sm">
                      <thead>
                        <tr className="text-blue-dark">
                          {["Fish type", "Seed size", "Quantity", "Rate", "Amount"].map((header) => (
                            <th key={header} className="px-2 py-1.5 text-xs font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((line: JourneyRateSupplierLine) => (
                          <tr key={line.lineKey} className="border-t border-line">
                            <td className="px-2 py-2">{line.fishType}</td>
                            <td className="px-2 py-2">{line.seedSize || "—"}</td>
                            <td className="px-2 py-2 tabular-nums">{line.quantity}</td>
                            <RateAmountCells
                              journeyId={record.journeyId}
                              lineKey={line.lineKey}
                              rateText={lineRates.rateTextFor(record.journeyId, line.lineKey)}
                              onRateTextChange={(value) =>
                                lineRates.onRateTextChange(record.journeyId, line.lineKey, value)
                              }
                              multiplier={line.quantity}
                            />
                          </tr>
                        ))}
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
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[260px] text-left text-sm">
                  <thead>
                    <tr className="text-blue-dark">
                      {["Vehicle", "Kilometres", "Rate", "Amount"].map((header) => (
                        <th key={header} className="px-2 py-1.5 text-xs font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((line) => (
                      <tr key={line.lineKey} className="border-t border-line">
                        <td className="px-2 py-2">{line.vehicleNumber}</td>
                        <td className="px-2 py-2 tabular-nums">
                          {line.kilometers != null ? `${line.kilometers} km` : "—"}
                        </td>
                        <RateAmountCells
                          journeyId={journeyId}
                          lineKey={line.lineKey}
                          rateText={lineRates.rateTextFor(journeyId, line.lineKey)}
                          onRateTextChange={(value) => lineRates.onRateTextChange(journeyId, line.lineKey, value)}
                          multiplier={line.kilometers}
                        />
                      </tr>
                    ))}
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

  if (syncedInitial !== initialRateTexts) {
    setSyncedInitial(initialRateTexts);
    setRatesByLine((current) => ({ ...initialRateTexts, ...current }));
  }

  function setLineRate(storageKey: string, value: string) {
    setRatesByLine((current) => ({ ...current, [storageKey]: value }));
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
    <div className="space-y-4">
      {rows.map((record) => (
        <JourneyRateCard
          key={record.journeyId}
          record={record}
          ratesByLine={ratesByLine}
          onRateChange={setLineRate}
        />
      ))}
    </div>
  );
}
