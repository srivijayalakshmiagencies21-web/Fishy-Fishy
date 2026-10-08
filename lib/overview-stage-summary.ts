import { trucksForFinalUnload, type JourneySummary } from "@/lib/journey-cards";
import { truckEndTypeBadgeClass, truckEndTypeLabel } from "@/lib/journey-end-type-styles";
import { buildFinalUnloadSummaryRows, journeyUnloadSubmitted } from "@/lib/journey-final-unload-summary";
import { journeyPointBadgeLabel } from "@/lib/journey-point-lanes";
import { startSummaryItemsForTruck } from "@/lib/journey-start-summary";
import {
  buildDefaultSummaryRows,
  buildTransferSummaryRows,
  type JourneySummaryTruckRow,
} from "@/lib/journey-transfer-summary";
import { hasPersistedTransferRecording } from "@/lib/journey-transfer-recording";
import { startPrimaryTrucks } from "@/lib/journey-truck-labels";
export type OverviewStage = "start" | "transfer" | "final";

export type OverviewStageSummaryConfig = {
  journey: JourneySummary;
  truckRows: JourneySummaryTruckRow[];
  detailMode: "items" | "unload_drops";
  odometerLabel: string;
  expandedSectionTitle: string;
  statusBadgeLabel: string;
  stageTitle: string;
  timestampLabel: string;
  timestampValue: string | null;
};

function mapStartItemsToCardItems(
  journey: JourneySummary,
  truck: { items?: any[]; start_items?: any[] },
) {
  return startSummaryItemsForTruck(journey, truck).map((item) => ({
    quantity: item.quantity,
    supplier: { name: item.supplier_name ?? item.supplier?.name ?? "Unknown" },
    fish: {
      fish_type: item.fish_type ?? item.fish?.fish_type ?? "—",
      seed_size: item.seed_size ?? item.fish?.seed_size ?? null,
    },
  }));
}

function buildStartSummaryRows(journey: JourneySummary): JourneySummaryTruckRow[] {
  return startPrimaryTrucks(journey).map((truck) => ({
    truck: {
      ...truck,
      items: mapStartItemsToCardItems(journey, truck),
    },
    badge: truckEndTypeLabel(truck.end_type),
    badgeClass: truckEndTypeBadgeClass(truck.end_type),
  }));
}

function startStageJourney(journey: JourneySummary): JourneySummary {
  const primaries = startPrimaryTrucks(journey);
  return {
    ...journey,
    trucks: primaries.map((truck) => ({
      ...truck,
      items: mapStartItemsToCardItems(journey, truck),
    })),
  };
}

/** Summary card props for a journey leg on the overview page (matches start / transfer / final pages). */
export function overviewStageSummaryConfig(
  journey: JourneySummary,
  stage: OverviewStage,
): OverviewStageSummaryConfig {
  if (stage === "start") {
    return {
      journey: startStageJourney(journey),
      truckRows: buildStartSummaryRows(journey),
      detailMode: "items",
      odometerLabel: "Start odometer",
      expandedSectionTitle: "Starting Point — Full Details",
      statusBadgeLabel: journeyPointBadgeLabel("start", journey.phase),
      stageTitle: "Start",
      timestampLabel: "Submitted on",
      timestampValue: journey.startTime,
    };
  }

  if (stage === "transfer") {
    const hasRecorded = hasPersistedTransferRecording(journey);
    return {
      journey,
      truckRows: hasRecorded ? buildTransferSummaryRows(journey) : buildDefaultSummaryRows(journey),
      detailMode: "items",
      odometerLabel: hasRecorded ? "Transfer odometer" : "Start odometer",
      expandedSectionTitle: hasRecorded ? "Transfer — Full Details" : "Starting Point — Full Details",
      statusBadgeLabel: journeyPointBadgeLabel("transfer", journey.phase),
      stageTitle: "Transfer",
      timestampLabel: hasRecorded ? "Transferred on" : "Submitted on",
      timestampValue: hasRecorded ? (journey.transferTime ?? journey.startTime) : journey.startTime,
    };
  }

  const unloadSubmitted = journeyUnloadSubmitted(journey);
  const hasRecorded = hasPersistedTransferRecording(journey);
  const finalTrucks = trucksForFinalUnload(journey.trucks);
  return {
    journey: { ...journey, trucks: finalTrucks },
    truckRows: unloadSubmitted
      ? buildFinalUnloadSummaryRows(journey)
      : buildDefaultSummaryRows({ ...journey, trucks: finalTrucks }),
    detailMode: unloadSubmitted ? "unload_drops" : "items",
    odometerLabel: unloadSubmitted ? "Final odometer" : "Transfer odometer",
    expandedSectionTitle: unloadSubmitted ? "Final unload — Full Details" : "Starting Point — Full Details",
    statusBadgeLabel: journeyPointBadgeLabel("final", journey.phase),
    stageTitle: "Final",
    timestampLabel: unloadSubmitted
      ? "Completed on"
      : hasRecorded
        ? "Transferred on"
        : "Submitted on",
    timestampValue: unloadSubmitted
      ? (journey.finalTime ?? journey.transferTime ?? journey.startTime)
      : hasRecorded
        ? (journey.transferTime ?? journey.startTime)
        : journey.startTime,
  };
}
