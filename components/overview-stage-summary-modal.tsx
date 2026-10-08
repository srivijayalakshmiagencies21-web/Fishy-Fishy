"use client";

import { useEffect, useState } from "react";
import { JourneySummaryCard } from "@/components/journey-summary-card";
import type { OverviewStage } from "@/lib/overview-stage-summary";
import { overviewStageSummaryConfig } from "@/lib/overview-stage-summary";
import type { OverviewJourneyRow } from "@/lib/overview-types";

type OpenState = {
  journeyId: string;
  stage: OverviewStage;
};

export function OverviewStageSummaryModal({
  journeys,
  open,
  onClose,
}: {
  journeys: OverviewJourneyRow[];
  open: OpenState | null;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (open) setExpanded(true);
  }, [open?.journeyId, open?.stage]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const journey = journeys.find((j) => j.id === open.journeyId);
  if (!journey) return null;

  const config = overviewStageSummaryConfig(journey, open.stage);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close summary"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="overview-stage-summary-title"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-white px-4 py-3">
          <p id="overview-stage-summary-title" className="text-sm font-semibold text-gray-800">
            {config.stageTitle} summary · Journey #{journey.db_id}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--page-bg,#f4f7fb)] p-4">
          <JourneySummaryCard
            journey={config.journey}
            truckRows={config.truckRows}
            detailMode={config.detailMode}
            odometerLabel={config.odometerLabel}
            expandedSectionTitle={config.expandedSectionTitle}
            timestampLabel={config.timestampLabel}
            timestampValue={config.timestampValue}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((v) => !v)}
            statusBadge={
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                {config.statusBadgeLabel}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}
