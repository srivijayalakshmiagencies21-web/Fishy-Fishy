"use client";

import { useState, type ReactNode } from "react";

const MIN_SWIPE_PX = 50;

export type MobileSummaryTab = { key: string; label: string; meta?: string; content: ReactNode };

/** Segmented tabs with cyclic swipe; rendered below `lg` only. */
export function MobileSummaryTabs({ tabs }: { tabs: MobileSummaryTab[] }) {
  const [active, setActive] = useState(0);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);
  const count = tabs.length;
  const current = tabs[Math.min(active, count - 1)];

  const go = (dir: -1 | 1) => setActive((prev) => (prev + dir + count) % count);

  return (
    <div className="lg:hidden">
      <div
        role="tablist"
        className="grid gap-1 rounded-xl bg-slate-100 p-1"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab, index) => {
          const selected = tab.key === current?.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(index)}
              className={`min-w-0 rounded-lg px-1 py-1.5 text-center transition-colors ${
                selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 active:bg-white/60"
              }`}
            >
              <span className="block truncate text-[11px] font-bold">{tab.label}</span>
              {tab.meta ? (
                <span
                  className={`block truncate font-mono text-[10px] tabular-nums ${
                    selected ? "text-rose-600" : "text-slate-400"
                  }`}
                >
                  {tab.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="mt-3 touch-pan-y"
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) setTouch({ x: t.clientX, y: t.clientY });
        }}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          if (!touch || !t) return;
          const dx = touch.x - t.clientX;
          const dy = touch.y - t.clientY;
          setTouch(null);
          if (Math.abs(dx) > MIN_SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? 1 : -1);
        }}
      >
        <div key={current?.key} className="animate-in fade-in duration-200">
          {current?.content}
        </div>
      </div>

      {count > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {tabs.map((tab) => (
            <span
              key={tab.key}
              className={`h-1.5 rounded-full transition-all ${
                tab.key === current?.key ? "w-4 bg-rose-500" : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
