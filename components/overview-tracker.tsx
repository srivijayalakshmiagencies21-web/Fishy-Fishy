"use client";

import { useState } from "react";
import { OverviewJourneyLedger } from "@/components/overview-journey-ledger";
import { OverviewStageSummaryModal } from "@/components/overview-stage-summary-modal";
import {
  JourneyPointLaneSection,
  JourneyPointLaneSwitcher,
  laneViewShowsClosed,
  laneViewShowsInProgress,
  type JourneyPointLaneView,
} from "@/components/journey-point-lane-toggle";
import { hasPersistedTransferRecording } from "@/lib/journey-transfer-recording";
import { JourneyPhase, normalizeJourneyPhase, type JourneyPhaseValue } from "@/lib/journey-phase";
import type { OverviewStage } from "@/lib/overview-stage-summary";
import type { OverviewJourneyRow } from "@/lib/overview-types";

type StopStatus = "done" | "active" | "upcoming";

type Stop = {
  key: OverviewStage;
  title: string;
  caption: string;
  truckCount: number;
  status: StopStatus;
  position: number;
};

function phaseProgressIndex(
  phase: JourneyPhaseValue,
  skip: boolean,
  transferRecorded: boolean,
) {
  if (skip) {
    if (phase === JourneyPhase.Start || phase === JourneyPhase.Transfer) return 0;
    if (phase === JourneyPhase.Final) return 1;
    return 2;
  }
  if (phase === JourneyPhase.Start) return 0;
  if (phase === JourneyPhase.Transfer) return transferRecorded ? 2 : 1;
  if (phase === JourneyPhase.Final) return 2;
  return 3;
}

function stopStatus(
  stopIndex: number,
  phase: JourneyPhaseValue,
  skip: boolean,
  transferRecorded: boolean,
): StopStatus {
  if (phase === JourneyPhase.Closed) return "done";
  const progress = phaseProgressIndex(phase, skip, transferRecorded);
  if (stopIndex < progress) return "done";
  if (stopIndex === progress) return "active";
  return "upcoming";
}

/** Truck marker along the leg: start→transfer (25%), at transfer (50%), transfer→final (75%), at final (100%). */
function truckPosition(
  phase: JourneyPhaseValue,
  skip: boolean,
  transferRecorded: boolean,
) {
  if (skip) {
    if (phase === JourneyPhase.Start || phase === JourneyPhase.Transfer) return 50;
    return 100;
  }
  if (phase === JourneyPhase.Start) return 25;
  if (phase === JourneyPhase.Transfer) return transferRecorded ? 75 : 50;
  return 100;
}

function movingTruckCount(
  phase: JourneyPhaseValue,
  skip: boolean,
  counts: OverviewJourneyRow["truckCounts"],
  transferRecorded: boolean,
) {
  if (phase === JourneyPhase.Start) return counts.start;
  if (phase === JourneyPhase.Transfer) {
    if (transferRecorded) return counts.final;
    return skip ? counts.start : counts.transfer;
  }
  return counts.final;
}

function formatTrucks(n: number) {
  if (n <= 0) return null;
  return `${n} truck${n === 1 ? "" : "s"}`;
}

function buildStops(
  journey: OverviewJourneyRow,
  phase: JourneyPhaseValue,
  transferRecorded: boolean,
): Stop[] {
  const skip = journey.skipsTransfer;
  const { start, transfer, final } = journey.truckCounts;
  const stops: Stop[] = [
    {
      key: "start",
      title: "Start",
      caption: journey.startLocation,
      truckCount: start,
      status: "done",
      position: 0,
    },
  ];
  if (!skip) {
    stops.push({
      key: "transfer",
      title: "Transfer",
      caption: journey.transferLocation,
      truckCount: transfer,
      status: stopStatus(1, phase, skip, transferRecorded),
      position: 50,
    });
  }
  stops.push({
    key: "final",
    title: "Final",
    caption: journey.finalDistrict,
    truckCount: final,
    status: stopStatus(skip ? 1 : 2, phase, skip, transferRecorded),
    position: 100,
  });
  return stops;
}

function stopLabelStyle(position: number): React.CSSProperties {
  if (position === 0) return { left: 0, transform: "translateX(-6px)", textAlign: "left" };
  if (position === 100) return { left: "100%", transform: "translateX(calc(-100% + 6px))", textAlign: "right" };
  return { left: `${position}%`, transform: "translateX(-50%)", textAlign: "center" };
}

function StopDot({ status }: { status: StopStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-600 ring-[3px] ring-white">
        <svg viewBox="0 0 12 12" className="h-2 w-2 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M2.5 6.2l2.2 2.2 4.8-4.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return <span className="block h-3.5 w-3.5 rounded-full border-[3px] border-blue-dark bg-white ring-4 ring-blue-soft" />;
  }
  return <span className="block h-3.5 w-3.5 rounded-full border-2 border-gray-300 bg-white ring-[3px] ring-white" />;
}

function TruckMarker({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="relative">
      <svg viewBox="0 0 30 20" className="block h-5 w-[30px]" aria-hidden>
        <rect x="1" y="2" width="18" height="12" rx="2" fill="#0b345a" />
        <path d="M20 5.5h4.5l4 4.5V14h-8.5z" fill="#0b345a" />
        <rect x="22" y="7" width="3.5" height="3" rx="0.5" fill="#e0f2fe" />
        <circle cx="7" cy="16" r="3.2" fill="#1f2937" stroke="#fff" strokeWidth="1.2" />
        <circle cx="23.5" cy="16" r="3.2" fill="#1f2937" stroke="#fff" strokeWidth="1.2" />
      </svg>
      <span className="absolute -top-2.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-gray-200 bg-white px-1 text-[10px] font-bold tabular-nums text-blue-dark shadow-sm">
        {count > 99 ? "99+" : count}
      </span>
    </div>
  );
}

function JourneyTrack({
  journey,
  onOpenStage,
}: {
  journey: OverviewJourneyRow;
  onOpenStage: (stage: OverviewStage) => void;
}) {
  const phase = normalizeJourneyPhase(journey.phase);
  const transferRecorded = hasPersistedTransferRecording(journey);
  const stops = buildStops(journey, phase, transferRecorded);
  const position = truckPosition(phase, journey.skipsTransfer, transferRecorded);
  const badgeCount = movingTruckCount(
    phase,
    journey.skipsTransfer,
    journey.truckCounts,
    transferRecorded,
  );
  const isClosed = phase === JourneyPhase.Closed;

  const openStage = (stage: OverviewStage) => {
    onOpenStage(stage);
  };

  return (
    <div className="px-8 pb-6 pt-4">
      <div className="relative h-[104px]">
        <div className="absolute inset-x-0 top-[38px] h-1.5 rounded-full bg-gray-200" />
        <div
          className="absolute left-0 top-[38px] h-1.5 rounded-full bg-green-600 transition-[width] duration-500 ease-out"
          style={{ width: `${position}%` }}
        />

        {stops.map((stop) => {
          const isDone = stop.status === "done";
          if (isDone) {
            return (
              <button
                key={stop.key}
                type="button"
                onClick={() => openStage(stop.key)}
                className="absolute top-[41px] -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-dark"
                style={{ left: `${stop.position}%` }}
                title={`View ${stop.title} summary`}
                aria-label={`View ${stop.title} summary`}
              >
                <StopDot status={stop.status} />
              </button>
            );
          }
          return (
            <div
              key={stop.key}
              className="absolute top-[41px] -translate-x-1/2 -translate-y-1/2 rounded-full cursor-not-allowed"
              style={{ left: `${stop.position}%` }}
              title={stop.status === "active" ? "In progress" : "Upcoming"}
            >
              <StopDot status={stop.status} />
            </div>
          );
        })}

        {badgeCount > 0 ? (
          <div
            className="absolute top-[16px] -translate-x-1/2 transition-[left] duration-500 ease-out"
            style={{ left: `${position}%` }}
            title={`${badgeCount} truck${badgeCount === 1 ? "" : "s"}${isClosed ? " · delivered" : ""}`}
          >
            <TruckMarker count={badgeCount} />
          </div>
        ) : null}

        {stops.map((stop) => {
          const isDone = stop.status === "done";
          const trucksLabel = formatTrucks(stop.truckCount);
          
          const content = (
            <>
              <p
                className={`text-xs font-semibold ${
                  stop.status === "upcoming" ? "text-gray-400" : stop.status === "active" ? "text-blue-dark" : "text-gray-900"
                }`}
              >
                {stop.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-gray-500" title={stop.caption || undefined}>
                {stop.caption || "—"}
              </p>
              {isDone && trucksLabel ? (
                <p className="mt-0.5 text-[10px] font-medium tabular-nums text-gray-400">{trucksLabel}</p>
              ) : null}
              {stop.status === "active" ? (
                <p className="mt-0.5 text-[10px] font-semibold text-blue-500 uppercase tracking-wide">In progress</p>
              ) : null}
            </>
          );

          if (isDone) {
            return (
              <button
                key={`${stop.key}-label`}
                type="button"
                onClick={() => openStage(stop.key)}
                className="absolute top-[56px] max-w-[9rem] cursor-pointer rounded-md text-left transition-colors hover:bg-blue-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-dark"
                style={stopLabelStyle(stop.position)}
                title={`View ${stop.title} summary`}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={`${stop.key}-label`}
              className="absolute top-[56px] max-w-[9rem] cursor-default text-left"
              style={stopLabelStyle(stop.position)}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JourneyCard({
  journey,
  onOpenStage,
}: {
  journey: OverviewJourneyRow;
  onOpenStage: (journeyId: string, stage: OverviewStage) => void;
}) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const phase = normalizeJourneyPhase(journey.phase);
  const isClosed = phase === JourneyPhase.Closed;

  return (
    <section className="surface overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-blue-dark">Journey #{journey.db_id}</h2>
        </div>
        {!isClosed ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-soft px-2.5 py-1 text-xs font-medium text-blue-dark">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-dark" />
            In progress
          </span>
        ) : null}
      </header>
      <JourneyTrack journey={journey} onOpenStage={(stage) => onOpenStage(journey.id, stage)} />
      {ledgerOpen ? <OverviewJourneyLedger journey={journey} /> : null}
      <button
        type="button"
        onClick={() => setLedgerOpen((open) => !open)}
        aria-expanded={ledgerOpen}
        aria-label={ledgerOpen ? "Collapse ledger" : "Expand ledger"}
        title={ledgerOpen ? "Collapse ledger" : "Expand ledger"}
        className="flex w-full items-center justify-center border-t border-line bg-gray-50/60 py-2.5 text-gray-400 transition-colors hover:bg-blue-soft/40 hover:text-blue-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-transform duration-200 ${ledgerOpen ? "rotate-180 text-blue-600" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </section>
  );
}

export function OverviewTracker({ journeys }: { journeys: OverviewJourneyRow[] }) {
  const [laneView, setLaneView] = useState<JourneyPointLaneView>("in_progress");
  const [summaryOpen, setSummaryOpen] = useState<{ journeyId: string; stage: OverviewStage } | null>(null);

  if (journeys.length === 0) {
    return (
      <div className="surface p-10 text-center">
        <p className="text-sm font-medium text-gray-700">No journeys yet</p>
        <p className="mt-1 text-xs text-muted">Journeys appear here once they are started.</p>
      </div>
    );
  }

  const inProgressJourneys = journeys.filter(
    (j) => normalizeJourneyPhase(j.phase) !== JourneyPhase.Closed,
  );
  const closedJourneys = journeys.filter(
    (j) => normalizeJourneyPhase(j.phase) === JourneyPhase.Closed,
  );

  return (
    <>
      <div className="space-y-6">
        <JourneyPointLaneSwitcher
          value={laneView}
          onChange={setLaneView}
          inProgressCount={inProgressJourneys.length}
          closedCount={closedJourneys.length}
        />

        <JourneyPointLaneSection title="In progress" hidden={!laneViewShowsInProgress(laneView)}>
          {inProgressJourneys.length === 0 ? (
            <div className="surface p-8 text-center text-sm font-medium text-gray-500">
              No in-progress journeys.
            </div>
          ) : (
            inProgressJourneys.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onOpenStage={(journeyId, stage) => setSummaryOpen({ journeyId, stage })}
              />
            ))
          )}
        </JourneyPointLaneSection>

        <JourneyPointLaneSection title="Closed" hidden={!laneViewShowsClosed(laneView)}>
          {closedJourneys.length === 0 ? (
            <div className="surface p-8 text-center text-sm font-medium text-gray-500">
              No closed journeys yet.
            </div>
          ) : (
            closedJourneys.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                onOpenStage={(journeyId, stage) => setSummaryOpen({ journeyId, stage })}
              />
            ))
          )}
        </JourneyPointLaneSection>
      </div>
      <OverviewStageSummaryModal journeys={journeys} open={summaryOpen} onClose={() => setSummaryOpen(null)} />
    </>
  );
}
