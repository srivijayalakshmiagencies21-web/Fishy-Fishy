"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createFinancialYear } from "@/app/(workspace)/financial-year/actions";
import {
  financialYearFromAprilStartYear,
  suggestedNextAprilStartYear,
  type FinancialYear,
} from "@/lib/financial-year";

export function FinancialYearAdd({
  years,
  canEdit,
}: {
  years: FinancialYear[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const defaultStart = suggestedNextAprilStartYear(years);
  const [startYear, setStartYear] = useState(String(defaultStart));
  const [state, action, pending] = useActionState(createFinancialYear, null);

  useEffect(() => {
    setStartYear(String(suggestedNextAprilStartYear(years)));
  }, [years]);

  const preview = useMemo(() => {
    const year = Number(startYear);
    if (!Number.isFinite(year)) return null;
    return financialYearFromAprilStartYear(year);
  }, [startYear]);

  useEffect(() => {
    if (!pending && state && "ok" in state && state.ok) {
      setOpen(false);
    }
  }, [pending, state]);

  if (!canEdit) return null;

  return (
    <div className="min-w-0">
      {open ? (
        <form action={action} className="surface rounded-2xl border border-line p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-blue-dark">Add financial year</h3>
            <button
              type="button"
              className="text-xs font-semibold text-blue hover:text-blue-dark"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
          <p className="mb-3 text-xs text-muted">Indian financial year: 1 April – 31 March.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Starts in April (year)</span>
              <input
                name="start_year"
                type="number"
                min={1990}
                max={2100}
                step={1}
                required
                value={startYear}
                onChange={(event) => setStartYear(event.target.value)}
                className="input-field !h-9 !min-h-9 w-[7rem] tabular-nums"
                placeholder="2028"
              />
            </label>
            {preview ? (
              <p className="pb-2 text-sm font-semibold text-blue-dark">
                → {preview.label}{" "}
                <span className="font-medium text-muted">
                  ({preview.startDate} – {preview.endDate})
                </span>
              </p>
            ) : null}
          </div>
          {state && "error" in state ? (
            <p className="mt-2 text-sm font-medium text-rose-700">{state.error}</p>
          ) : null}
          <button type="submit" disabled={pending || !preview} className="btn-primary mt-4 w-full sm:w-auto">
            {pending ? "Adding…" : "Add year"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary w-full sm:w-auto"
        >
          + Add FY
        </button>
      )}
    </div>
  );
}
