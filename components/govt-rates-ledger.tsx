"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useState, useTransition } from "react";
import { createFinancialYear } from "@/app/(workspace)/financial-year/actions";
import {
  createGovtLedgerRow,
  saveGovtLedgerBatch,
} from "@/app/(workspace)/vendor-govt-rates/actions";
import { ModalOverlay } from "@/components/fixed-overlay";
import { SelectField } from "@/components/select-field";
import {
  financialYearFromAprilStartYear,
  suggestedNextAprilStartYear,
  type FinancialYear,
} from "@/lib/financial-year";
import type { GovtRateLedgerRow } from "@/lib/govt-rates.server";
import type { DistrictRow } from "@/lib/masters";
import { salesAmount } from "@/lib/overview-sales";
import { formatAmount } from "@/lib/transactions";

const numberInputClass =
  "input-field !h-9 !min-h-9 !w-full !max-w-[7rem] !py-0.5 !px-2 tabular-nums text-sm font-semibold text-center";

type LedgerDraftRow = {
  rate: string;
  govt_recorded_qty: string;
  govt_allotted_qty: string;
};

function formatLedgerNumber(value: number | null): string {
  if (value == null) return "";
  return String(value);
}

function draftFromRows(rows: GovtRateLedgerRow[]): Record<number, LedgerDraftRow> {
  const draft: Record<number, LedgerDraftRow> = {};
  for (const row of rows) {
    draft[row.id] = {
      rate: formatLedgerNumber(row.rate),
      govt_recorded_qty: formatLedgerNumber(row.govtRecordedQty),
      govt_allotted_qty: formatLedgerNumber(row.govtAllottedQty),
    };
  }
  return draft;
}

function rowsStoredSignature(rows: GovtRateLedgerRow[]): string {
  return rows
    .map(
      (row) =>
        `${row.id}:${row.rate ?? ""}:${row.govtRecordedQty ?? ""}:${row.govtAllottedQty ?? ""}`,
    )
    .join("|");
}

function sumDraftQty(rows: GovtRateLedgerRow[], draft: Record<number, LedgerDraftRow>, field: keyof LedgerDraftRow) {
  let total = 0;
  let hasValue = false;
  for (const row of rows) {
    const raw = draft[row.id]?.[field]?.trim() ?? "";
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    hasValue = true;
    total += parsed;
  }
  return { total, hasValue };
}

function formatQtyTotal(total: number, hasValue: boolean): string {
  if (!hasValue) return "—";
  return total.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function parseDraftNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function draftSaleAmount(rateStr: string, qtyStr: string): number | null {
  return salesAmount(parseDraftNumber(rateStr), parseDraftNumber(qtyStr));
}

function formatSaleAmount(amount: number | null): string {
  if (amount == null) return "—";
  return formatAmount(amount);
}

function LedgerNumberInput({
  value,
  onChange,
  ariaLabel,
  disabled,
  fullWidth = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step="any"
      disabled={disabled}
      aria-label={ariaLabel}
      value={value}
      className={`${numberInputClass} ${fullWidth ? "!max-w-none" : ""}`}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function LedgerDistrictCard({
  row,
  rowDraft,
  yearLabel,
  canEdit,
  savePending,
  onFieldChange,
}: {
  row: GovtRateLedgerRow;
  rowDraft: LedgerDraftRow;
  yearLabel: string;
  canEdit: boolean;
  savePending: boolean;
  onFieldChange: (field: keyof LedgerDraftRow, value: string) => void;
}) {
  const disabled = !canEdit || savePending;
  const allocatedSale = draftSaleAmount(rowDraft.rate, rowDraft.govt_allotted_qty);
  const recordedSale = draftSaleAmount(rowDraft.rate, rowDraft.govt_recorded_qty);

  return (
    <article className="rounded-xl border border-line bg-white p-3.5 shadow-xs">
      <h3 className="text-sm font-bold text-blue-dark">{row.districtName}</h3>
      <p className="mt-1 text-xs leading-snug text-slate-600">{row.companyNames.join(", ")}</p>
      <div className="mt-3 grid grid-cols-1 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Govt rate</span>
          <LedgerNumberInput
            value={rowDraft.rate}
            onChange={(value) => onFieldChange("rate", value)}
            ariaLabel={`Govt rate for ${yearLabel} ${row.districtName}`}
            disabled={disabled}
            fullWidth
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Govt recorded qty</span>
          <LedgerNumberInput
            value={rowDraft.govt_recorded_qty}
            onChange={(value) => onFieldChange("govt_recorded_qty", value)}
            ariaLabel={`Govt recorded quantity for ${yearLabel} ${row.districtName}`}
            disabled={disabled}
            fullWidth
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Govt allotted qty</span>
          <LedgerNumberInput
            value={rowDraft.govt_allotted_qty}
            onChange={(value) => onFieldChange("govt_allotted_qty", value)}
            ariaLabel={`Govt allotted quantity for ${yearLabel} ${row.districtName}`}
            disabled={disabled}
            fullWidth
          />
        </label>
        <div className="flex items-center justify-between gap-3 border-t border-line/60 pt-2 text-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Allocated sale</span>
          <span className="font-bold tabular-nums text-slate-900">{formatSaleAmount(allocatedSale)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Recorded sale</span>
          <span className="font-bold tabular-nums text-slate-900">{formatSaleAmount(recordedSale)}</span>
        </div>
      </div>
    </article>
  );
}

function GovtRatesYearSection({
  yearLabel,
  rows,
  canEdit,
  expanded,
  onToggle,
}: {
  yearLabel: string;
  rows: GovtRateLedgerRow[];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftFromRows(rows));
  const [saveState, saveAction, savePending] = useActionState(saveGovtLedgerBatch, null);
  const [, startSave] = useTransition();
  const storedSignature = useMemo(() => rowsStoredSignature(rows), [rows]);

  useEffect(() => {
    setDraft(draftFromRows(rows));
  }, [storedSignature, rows]);

  useEffect(() => {
    if (!savePending && saveState && "ok" in saveState && saveState.ok) {
      router.refresh();
    }
  }, [savePending, saveState, router]);

  function setField(ledgerId: number, field: keyof LedgerDraftRow, value: string) {
    setDraft((prev) => ({
      ...prev,
      [ledgerId]: { ...prev[ledgerId], [field]: value },
    }));
  }

  const recordedTotal = useMemo(
    () => sumDraftQty(rows, draft, "govt_recorded_qty"),
    [draft, rows],
  );
  const allottedTotal = useMemo(
    () => sumDraftQty(rows, draft, "govt_allotted_qty"),
    [draft, rows],
  );

  function handleSave() {
    const updates = rows
      .map((row) => {
        const current = draft[row.id];
        if (!current) return null;
        return {
          ledger_id: row.id,
          rate: current.rate,
          govt_recorded_qty: current.govt_recorded_qty,
          govt_allotted_qty: current.govt_allotted_qty,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null);

    if (updates.length === 0) return;

    const formData = new FormData();
    formData.set("updates", JSON.stringify(updates));
    startSave(() => {
      saveAction(formData);
    });
  }

  return (
    <div className="surface overflow-hidden rounded-2xl border border-line transition-all duration-200">
      <header
        className={`bg-[var(--page)] px-4 py-3 sm:px-5 ${
          expanded ? "rounded-t-2xl border-b border-line" : "rounded-2xl"
        }`}
      >
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 items-center gap-2 text-left transition-colors hover:text-blue-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded-lg md:flex-1"
            aria-expanded={expanded}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-bold text-blue-dark">{yearLabel}</span>
            <span className="text-xs font-medium text-muted">
              {rows.length} district{rows.length === 1 ? "" : "s"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:justify-end">
            <span
              className="inline-flex min-w-0 items-center justify-between gap-1 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-900 sm:justify-start sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
              title="Sum of govt recorded qty for this year"
            >
              <span className="shrink-0 font-semibold text-emerald-700/90">Recorded</span>
              <span className="truncate tabular-nums">
                {formatQtyTotal(recordedTotal.total, recordedTotal.hasValue)}
              </span>
            </span>
            <span
              className="inline-flex min-w-0 items-center justify-between gap-1 rounded-lg border border-blue-200/80 bg-blue-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-dark sm:justify-start sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
              title="Sum of govt allotted qty for this year"
            >
              <span className="shrink-0 font-semibold text-blue/90">Allotted</span>
              <span className="truncate tabular-nums">
                {formatQtyTotal(allottedTotal.total, allottedTotal.hasValue)}
              </span>
            </span>
            {canEdit && expanded ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={savePending}
                className="btn-primary col-span-2 !min-h-9 w-full !px-4 !py-1.5 !text-sm md:col-span-1 md:w-auto"
              >
                {savePending ? "Saving…" : "Save"}
              </button>
            ) : null}
          </div>
        </div>
        {expanded && saveState && "error" in saveState ? (
          <p className="mt-2 text-sm text-rose-700">{saveState.error}</p>
        ) : null}
      </header>

      {expanded ? (
        <>
          <div className="space-y-3 bg-[var(--page)] p-3 md:hidden">
            {rows.map((row) => {
              const rowDraft = draft[row.id];
              if (!rowDraft) return null;
              return (
                <LedgerDistrictCard
                  key={row.id}
                  row={row}
                  rowDraft={rowDraft}
                  yearLabel={yearLabel}
                  canEdit={canEdit}
                  savePending={savePending}
                  onFieldChange={(field, value) => setField(row.id, field, value)}
                />
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-white text-xs font-bold uppercase tracking-wider text-muted">
                  <th className="px-3 py-3 sm:px-4">District</th>
                  <th className="px-3 py-3 sm:px-4">Company</th>
                  <th className="px-3 py-3 sm:px-4">Govt rate</th>
                  <th className="px-3 py-3 sm:px-4">Govt recorded qty</th>
                  <th className="px-3 py-3 sm:px-4">Govt allotted qty</th>
                  <th className="px-3 py-3 sm:px-4">Allocated sale</th>
                  <th className="px-3 py-3 sm:px-4">Recorded sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((row) => {
                  const rowDraft = draft[row.id];
                  if (!rowDraft) return null;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-medium text-slate-800 sm:px-4">{row.districtName}</td>
                      <td className="px-3 py-3 font-medium text-slate-800 sm:px-4">
                        {row.companyNames.join(", ")}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <LedgerNumberInput
                          value={rowDraft.rate}
                          onChange={(value) => setField(row.id, "rate", value)}
                          ariaLabel={`Govt rate for ${yearLabel} ${row.districtName}`}
                          disabled={!canEdit || savePending}
                        />
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <LedgerNumberInput
                          value={rowDraft.govt_recorded_qty}
                          onChange={(value) => setField(row.id, "govt_recorded_qty", value)}
                          ariaLabel={`Govt recorded quantity for ${yearLabel} ${row.districtName}`}
                          disabled={!canEdit || savePending}
                        />
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <LedgerNumberInput
                          value={rowDraft.govt_allotted_qty}
                          onChange={(value) => setField(row.id, "govt_allotted_qty", value)}
                          ariaLabel={`Govt allotted quantity for ${yearLabel} ${row.districtName}`}
                          disabled={!canEdit || savePending}
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                        {formatSaleAmount(
                          draftSaleAmount(rowDraft.rate, rowDraft.govt_allotted_qty),
                        )}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-slate-900 sm:px-4">
                        {formatSaleAmount(
                          draftSaleAmount(rowDraft.rate, rowDraft.govt_recorded_qty),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AddGovtLedgerModal({
  open,
  onClose,
  financialYears,
  districts,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  financialYears: FinancialYear[];
  districts: DistrictRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const ledgerFormId = useId();
  const [state, action, pending] = useActionState(createGovtLedgerRow, null);
  const [fyCreateState, fyCreateAction, fyCreatePending] = useActionState(createFinancialYear, null);
  const [showAddFy, setShowAddFy] = useState(false);
  const [startYear, setStartYear] = useState(() => String(suggestedNextAprilStartYear(financialYears)));

  const [financialYearId, setFinancialYearId] = useState("");
  const [districtIds, setDistrictIds] = useState<string[]>([]);
  const [companiesByDistrict, setCompaniesByDistrict] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    setFinancialYearId("");
    setDistrictIds([]);
    setCompaniesByDistrict({});
    setShowAddFy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStartYear(String(suggestedNextAprilStartYear(financialYears)));
  }, [open, financialYears]);

  useEffect(() => {
    if (!pending && state && "ok" in state && state.ok) {
      onClose();
      router.refresh();
    }
  }, [pending, state, onClose, router]);

  useEffect(() => {
    if (!fyCreatePending && fyCreateState && "ok" in fyCreateState && fyCreateState.ok) {
      setFinancialYearId(String(fyCreateState.id));
      setShowAddFy(false);
      router.refresh();
    }
  }, [fyCreatePending, fyCreateState, router]);

  const districtOptions = useMemo(
    () => districts.map((row) => ({ value: String(row.id), label: row.name })),
    [districts],
  );

  const selectedDistricts = useMemo(
    () =>
      districtIds
        .map((id) => districts.find((row) => String(row.id) === id))
        .filter((row): row is DistrictRow => row != null),
    [districtIds, districts],
  );

  useEffect(() => {
    setCompaniesByDistrict((prev) => {
      const next: Record<string, string[]> = {};
      for (const districtId of districtIds) {
        const allowed = new Set(
          (districts.find((row) => String(row.id) === districtId)?.companies ?? []).map((company) =>
            String(company.id),
          ),
        );
        next[districtId] = (prev[districtId] ?? []).filter((companyId) => allowed.has(companyId));
      }
      return next;
    });
  }, [districtIds, districts]);

  const districtSetupCount = useMemo(
    () =>
      districtIds.filter((districtId) => (companiesByDistrict[districtId]?.length ?? 0) > 0).length,
    [districtIds, companiesByDistrict],
  );

  function companyOptionsForDistrict(districtId: string) {
    const district = districts.find((row) => String(row.id) === districtId);
    return (district?.companies ?? []).map((company) => ({
      value: String(company.id),
      label: company.label,
    }));
  }

  function setCompaniesForDistrict(districtId: string, companyIds: string[]) {
    setCompaniesByDistrict((prev) => ({ ...prev, [districtId]: companyIds }));
  }

  const fyPreview = useMemo(() => {
    const year = Number(startYear);
    if (!Number.isFinite(year)) return null;
    return financialYearFromAprilStartYear(year);
  }, [startYear]);

  const financialYearMenuFooter = useMemo(() => {
    if (!canEdit) return null;
    if (showAddFy) {
      return (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">New FY</span>
            <button
              type="button"
              className="text-xs font-semibold text-blue hover:text-blue-dark"
              onClick={() => setShowAddFy(false)}
            >
              Back
            </button>
          </div>
          <p className="text-xs text-muted">Indian FY: 1 Apr – 31 Mar</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-muted">April start year</span>
              <input
                form={ledgerFormId}
                name="start_year"
                type="number"
                min={1990}
                max={2100}
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="input-field !h-9 w-full tabular-nums"
              />
            </label>
            {fyPreview ? (
              <p className="pb-2 text-sm font-bold text-blue-dark">{fyPreview.label}</p>
            ) : null}
          </div>
          {fyCreateState && "error" in fyCreateState ? (
            <p className="text-sm text-rose-700">{fyCreateState.error}</p>
          ) : null}
          <button
            type="submit"
            form={ledgerFormId}
            formAction={fyCreateAction}
            disabled={fyCreatePending || !fyPreview}
            className="btn-primary !min-h-9 w-full !text-sm"
          >
            {fyCreatePending ? "Adding…" : "Add FY"}
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setShowAddFy(true)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold text-blue hover:bg-blue-soft/50"
      >
        <span className="text-base leading-none">+</span>
        Add FY
      </button>
    );
  }, [
    canEdit,
    showAddFy,
    startYear,
    fyPreview,
    fyCreateState,
    fyCreatePending,
    fyCreateAction,
    ledgerFormId,
  ]);

  if (!open) return null;

  return (
    <ModalOverlay
      className="z-[80] flex items-center justify-center bg-blue-dark/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-govt-ledger-title"
    >
      <div className="surface flex w-full max-w-xl flex-col overflow-hidden shadow-2xl max-h-[min(calc(var(--modal-visible-height,100dvh)-1.5rem),640px)]">
        <div className="flex items-center justify-between border-b border-line bg-blue-soft/30 px-5 py-4">
          <h2 id="add-govt-ledger-title" className="text-lg font-bold text-blue-dark">
            Configure FY
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-black/5 hover:text-ink"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <form id={ledgerFormId} action={action} className="flex flex-1 flex-col overflow-hidden">
          <div className="modal-body-scroll flex-1 space-y-4 p-5" data-modal-scroll>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">Financial year</label>
              <SelectField
                name="financial_year_id"
                required
                placeholder="Select FY"
                emptyMessage="No years yet — add one below"
                options={financialYears.map((year) => ({
                  value: String(year.id),
                  label: year.label,
                }))}
                value={financialYearId}
                autoSelectWhenSingle={false}
                disabled={!canEdit || pending}
                onChange={setFinancialYearId}
                menuFooter={financialYearMenuFooter}
                menuExpanded={showAddFy}
              />
            </div>

            {districtIds.flatMap((districtId) =>
              (companiesByDistrict[districtId] ?? []).map((companyId) => (
                <input
                  key={`${districtId}-${companyId}`}
                  type="hidden"
                  name="pair"
                  value={`${districtId}:${companyId}`}
                />
              )),
            )}

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">Districts</label>
              <SelectField
                multiple
                showCountOnly
                placeholder="Select districts"
                options={districtOptions}
                valueMultiple={districtIds}
                autoSelectWhenSingle={false}
                disabled={!canEdit || pending}
                onChangeMultiple={setDistrictIds}
              />

              {selectedDistricts.length > 0 ? (
                <div className="rounded-xl border border-line bg-[var(--page)] p-3 sm:p-4 space-y-3">
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,8.5rem)_1fr] sm:gap-4 sm:px-1">
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                      District
                    </span>
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                      Companies
                    </span>
                  </div>
                  {selectedDistricts.map((district) => {
                    const districtId = String(district.id);
                    const companyOptions = companyOptionsForDistrict(districtId);
                    return (
                      <div
                        key={districtId}
                        className="grid grid-cols-1 gap-2 border-t border-line/60 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,8.5rem)_1fr] sm:items-center sm:gap-4"
                      >
                        <p className="text-sm font-bold text-blue-dark sm:py-2">{district.name}</p>
                        <SelectField
                          multiple
                          showCountOnly
                          placeholder={
                            companyOptions.length > 0 ? "Select companies" : "No companies in Masters"
                          }
                          options={companyOptions}
                          valueMultiple={companiesByDistrict[districtId] ?? []}
                          autoSelectWhenSingle={false}
                          disabled={!canEdit || pending || companyOptions.length === 0}
                          onChangeMultiple={(companyIds) => setCompaniesForDistrict(districtId, companyIds)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted">Select one or more districts, then choose companies for each.</p>
              )}

              {districtSetupCount > 0 ? (
                <p className="text-xs text-muted">
                  Sets up {districtSetupCount} district row{districtSetupCount === 1 ? "" : "s"} for this financial
                  year.
                </p>
              ) : null}
            </div>

            {state && "error" in state ? (
              <p className="text-sm font-medium text-rose-700">{state.error}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            <button type="button" onClick={onClose} className="btn-quiet">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canEdit || pending || !financialYearId || districtSetupCount === 0}
              className="btn-primary"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

export function GovtRatesLedger({
  rows,
  financialYears,
  districts,
  canEdit,
}: {
  rows: GovtRateLedgerRow[];
  financialYears: FinancialYear[];
  districts: DistrictRow[];
  canEdit: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const [collapsedYearIds, setCollapsedYearIds] = useState<Set<number>>(() => new Set());

  const yearGroups = useMemo(() => {
    const map = new Map<number, { id: number; label: string; rows: GovtRateLedgerRow[] }>();
    for (const row of rows) {
      let group = map.get(row.financialYearId);
      if (!group) {
        group = { id: row.financialYearId, label: row.financialYearLabel, rows: [] };
        map.set(row.financialYearId, group);
      }
      group.rows.push(row);
    }
    for (const group of map.values()) {
      group.rows.sort((a, b) => a.districtName.localeCompare(b.districtName));
    }
    return [...map.values()].sort((a, b) => b.label.localeCompare(a.label));
  }, [rows]);

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-start px-1">
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary w-full sm:w-auto">
            Configure FY
          </button>
        </div>
      ) : null}

      <AddGovtLedgerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        financialYears={financialYears}
        districts={districts}
        canEdit={canEdit}
      />

      {yearGroups.length === 0 ? (
        <p className="rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm text-muted">
          No govt rate rows yet. Use Configure FY to set up a financial year, district, and company.
        </p>
      ) : (
        <div className="space-y-3">
          {yearGroups.map((group) => (
            <GovtRatesYearSection
              key={group.id}
              yearLabel={group.label}
              rows={group.rows}
              canEdit={canEdit}
              expanded={!collapsedYearIds.has(group.id)}
              onToggle={() => {
                setCollapsedYearIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
