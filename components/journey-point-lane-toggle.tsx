"use client";

import type { ReactNode } from "react";

export type JourneyPointLaneView = "in_progress" | "closed";

const MODES: { id: JourneyPointLaneView; label: string }[] = [
  { id: "in_progress", label: "In progress" },
  { id: "closed", label: "Closed" },
];

export function JourneyPointLaneSwitcher({
  value,
  onChange,
  inProgressCount,
  closedCount,
}: {
  value: JourneyPointLaneView;
  onChange: (value: JourneyPointLaneView) => void;
  inProgressCount: number;
  closedCount: number;
}) {
  const countFor = (mode: JourneyPointLaneView) =>
    mode === "in_progress" ? inProgressCount : closedCount;

  return (
    <div
      className="segmented-control journey-lane-switcher"
      role="tablist"
      aria-label="Journey list filter"
    >
      {MODES.map((mode) => {
        const selected = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(mode.id)}
            className={`segmented-btn journey-lane-switcher-btn ${selected ? "active" : ""}`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <span>{mode.label}</span>
              <span className="tabular-nums opacity-90">({countFor(mode.id)})</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function laneViewShowsInProgress(view: JourneyPointLaneView) {
  return view === "in_progress";
}

export function laneViewShowsClosed(view: JourneyPointLaneView) {
  return view === "closed";
}

export function JourneyPointLaneSection({
  title,
  hidden,
  children,
}: {
  title: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  if (hidden) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-400">{title}</h2>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
