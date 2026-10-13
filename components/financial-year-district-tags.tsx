"use client";

import { useActionState, useEffect, useState } from "react";
import { saveFinancialYearDistricts } from "@/app/(workspace)/financial-year/actions";
import type { DistrictRow } from "@/lib/masters";

export function FinancialYearDistrictTags({
  financialYearId,
  financialYearLabel,
  districts,
  taggedDistrictIds,
  canEdit,
}: {
  financialYearId: number;
  financialYearLabel: string;
  districts: DistrictRow[];
  taggedDistrictIds: number[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveFinancialYearDistricts, null);
  const [selected, setSelected] = useState(() => new Set(taggedDistrictIds));

  useEffect(() => {
    setSelected(new Set(taggedDistrictIds));
  }, [financialYearId, taggedDistrictIds]);

  function toggle(id: number) {
    if (!canEdit) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const saved = state && "ok" in state && state.ok;

  return (
    <section className="surface rounded-2xl border border-line p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-blue-dark">Districts for {financialYearLabel}</h2>
          <p className="text-xs text-muted">
            Choose which districts from masters are tagged for this financial year.
          </p>
        </div>
        {saved ? (
          <p className="text-xs font-semibold text-emerald-700" role="status">Saved</p>
        ) : null}
      </div>

      {districts.length === 0 ? (
        <p className="text-sm text-muted">Add districts in masters first, then tag them here.</p>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="financial_year_id" value={financialYearId} />
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {districts.map((district) => {
              const checked = selected.has(district.id);
              return (
                <li key={district.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      checked
                        ? "border-blue/30 bg-blue-soft text-blue-dark"
                        : "border-line bg-white text-slate-700 hover:bg-slate-50"
                    } ${!canEdit ? "cursor-default opacity-80" : ""}`}
                  >
                    <input
                      type="checkbox"
                      name="district_id"
                      value={district.id}
                      checked={checked}
                      disabled={!canEdit || pending}
                      className="h-4 w-4 rounded border-line text-blue focus:ring-blue"
                      onChange={() => toggle(district.id)}
                    />
                    <span className="min-w-0 truncate">{district.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {state && "error" in state ? (
            <p className="text-sm font-medium text-rose-700">{state.error}</p>
          ) : null}
          {canEdit ? (
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full sm:w-auto disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save districts"}
            </button>
          ) : (
            <p className="text-xs text-muted">You can view tagged districts; editing requires access to Vendor &amp; Govt Rates.</p>
          )}
        </form>
      )}
    </section>
  );
}
