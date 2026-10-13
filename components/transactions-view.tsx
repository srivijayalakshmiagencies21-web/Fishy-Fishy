"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createTransaction, deleteTransaction, type FormState } from "@/app/(workspace)/finance/actions";
import { BodyPortal, ModalOverlay } from "@/components/fixed-overlay";
import { DateField } from "@/components/date-field";
import { FinanceKpiCards } from "@/components/finance-kpi-cards";
import { PartyField } from "@/components/party-field";
import { SelectField } from "@/components/select-field";
import { masterPartyNameSet, rememberCustomParty, rememberPcCustomParty } from "@/lib/finance-party-memory";
import {
  categoryPartyFieldConfig,
  normalizeTransactionCategoryKey,
  type CategoryPartyFieldConfig,
  type PartyVendorRecord,
} from "@/lib/finance-party-vendors";
import type { CategoryMeta, FinanceKpiWallet } from "@/lib/finance-kpi";
import type { FinanceKpiVariant } from "@/lib/finance-kpi";
import type { FinancialYear } from "@/lib/financial-year";
import type { NamedRow, TransactionCategoryRow } from "@/lib/masters";
import {
  categoriesForType,
  defaultTxnTypeForCategories,
  formatAmount,
  isCashPaymentMode,
  journeyNumberLabel,
  todayIsoDate,
  transactionAllocationFields,
  transactionEndpointMode,
  transactionLedgerEndpoints,
  txnTypeLabel,
  txnTypeSelectOptions,
  txnTypesForCategories,
  type TxnEndpointMode,
  type JourneyPickRow,
  type TransactionAccountOption,
  type TransactionRow,
  type TxnType,
} from "@/lib/transactions";

const inputClass = "input-field";

type LedgerSortKey = "date" | "amount" | "journey";
type SortDir = "asc" | "desc";

const SORT_OPTIONS = [
  { value: "date:desc", label: "Date · newest" },
  { value: "date:asc", label: "Date · oldest" },
  { value: "amount:desc", label: "Amount · high" },
  { value: "amount:asc", label: "Amount · low" },
  { value: "journey:asc", label: "Journey · low" },
  { value: "journey:desc", label: "Journey · high" },
];

function allFilterOption(label: string) {
  return { value: "", label };
}

function LedgerSortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className="inline-flex w-3 shrink-0 items-center justify-center text-[0.65rem] leading-none text-muted"
      aria-hidden
    >
      {active ? (dir === "asc" ? "↑" : "↓") : null}
    </span>
  );
}

function SortableLedgerHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: LedgerSortKey;
  activeKey: LedgerSortKey;
  sortDir: SortDir;
  onSort: (key: LedgerSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 hover:text-blue-dark/80"
      >
        {label}
        <LedgerSortArrow active={active} dir={sortDir} />
      </button>
    </th>
  );
}

function TransactionEndpointField({
  mode,
  side,
  type,
  paymentMode,
  value,
  onChange,
  placeholder,
  disabled,
  accountOptions,
  partyVendors,
  partyDistricts,
  partySocieties,
  categoryPartyConfig,
}: {
  mode: TxnEndpointMode;
  side: "from" | "to";
  type: TxnType;
  paymentMode: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  accountOptions: { value: string; label: string }[];
  partyVendors: string[];
  partyDistricts: string[];
  partySocieties: string[];
  categoryPartyConfig: CategoryPartyFieldConfig;
}) {
  const name = side === "from" ? "from_value" : "to_value";
  if (mode === "party") {
    return (
      <PartyField
        name={name}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        vendors={categoryPartyConfig.vendors}
        districts={categoryPartyConfig.districts}
        societies={categoryPartyConfig.societies}
        vendorsOnly={categoryPartyConfig.vendorsOnly}
        districtsOnly={categoryPartyConfig.districtsOnly}
        societiesOnly={categoryPartyConfig.societiesOnly}
        partyRecentsScope={categoryPartyConfig.partyRecentsScope}
        enforcePickList={categoryPartyConfig.enforceList}
        aria-label={side === "from" ? "From party" : "To party"}
      />
    );
  }
  return (
    <SelectField
      key={`${side}-${type}-${paymentMode}`}
      required
      searchable
      value={value}
      onChange={onChange}
      autoSelectWhenSingle={false}
      placeholder={placeholder}
      disabled={disabled}
      options={accountOptions}
    />
  );
}

function AccountPartyLabel({ side, type }: { side: "from" | "to"; type: TxnType }) {
  const role = transactionEndpointMode(type, side) === "account" ? "Account" : "Party";
  return (
    <>
      {side === "from" ? "From" : "To"} {role}
    </>
  );
}

function FieldStack({
  label,
  className = "block space-y-1",
  children,
}: {
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`field-stack ${className}`}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

export function TransactionsView({
  rows,
  accounts,
  paymentModes,
  categories,
  journeys,
  districts,
  partyVendors,
  partyVendorRecords,
  partySocieties,
  categoryMetaByName,
  financeKpiVariant,
  financeKpiWallets,
  categoryScope,
  financialYears,
  districtIdsByFinancialYear,
  ledgerAccountLabelById = {},
  loadError,
}: {
  rows: TransactionRow[];
  accounts: TransactionAccountOption[];
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  journeys: JourneyPickRow[];
  districts: NamedRow[];
  financialYears: FinancialYear[];
  districtIdsByFinancialYear: Record<number, number[]>;
  partyVendors: string[];
  partyVendorRecords: PartyVendorRecord[];
  partySocieties: string[];
  categoryMetaByName: Record<string, CategoryMeta>;
  financeKpiVariant: FinanceKpiVariant;
  financeKpiWallets: FinanceKpiWallet[];
  categoryScope: "full" | "role";
  ledgerAccountLabelById?: Record<number, string>;
  loadError: string | null;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [sortKey, setSortKey] = useState<LedgerSortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.label]));
    for (const [id, label] of Object.entries(ledgerAccountLabelById)) {
      map.set(Number(id), label);
    }
    return (id: number) => map.get(id) ?? "—";
  }, [accounts, ledgerAccountLabelById]);

  const districtName = useMemo(() => {
    const map = new Map(districts.map((d) => [d.id, d.label]));
    return (id: number | null) => (id == null ? "—" : (map.get(id) ?? "—"));
  }, [districts]);

  const journeyLabel = useMemo(() => {
    const map = new Map(journeys.map((j) => [j.id, j]));
    return (id: string | null) => {
      if (!id) return "";
      const journey = map.get(id);
      return journey ? journeyNumberLabel(journey.number) : "—";
    };
  }, [journeys]);

  const journeyById = useMemo(() => new Map(journeys.map((j) => [j.id, j])), [journeys]);

  const ledgerEntries = useMemo(
    () =>
      rows.map((row) => ({
        row,
        endpoints: transactionLedgerEndpoints(row, accountName),
      })),
    [rows, accountName],
  );

  const typeCounts = useMemo(() => {
    let all = ledgerEntries.length;
    let inCount = 0;
    let outCount = 0;
    let transferCount = 0;
    for (const { row } of ledgerEntries) {
      if (row.type === "in") inCount++;
      else if (row.type === "out") outCount++;
      else if (row.type === "transfer") transferCount++;
    }
    return { all, inCount, outCount, transferCount };
  }, [ledgerEntries]);

  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const fromLabels = new Set<string>();
    const toLabels = new Set<string>();
    const payments = new Set<string>();
    const districtIds = new Set<number>();

    for (const { row, endpoints } of ledgerEntries) {
      const cat = row.category.trim();
      if (cat) categories.add(cat);
      if (endpoints.from && endpoints.from !== "—") fromLabels.add(endpoints.from);
      if (endpoints.to && endpoints.to !== "—") toLabels.add(endpoints.to);
      if (row.payment_mode.trim()) payments.add(row.payment_mode.trim());
      if (row.district_id != null) districtIds.add(row.district_id);
    }

    const sortLabels = (values: Set<string>) =>
      [...values].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));

    return {
      category: sortLabels(categories),
      from: sortLabels(fromLabels),
      to: sortLabels(toLabels),
      payment: sortLabels(payments),
      district: districts
        .filter((d) => districtIds.has(d.id))
        .map((d) => ({ value: String(d.id), label: d.label })),
    };
  }, [ledgerEntries, districts]);

  const hasActiveFilters =
    Boolean(filterType) ||
    Boolean(filterCategory) ||
    Boolean(filterFrom) ||
    Boolean(filterTo) ||
    Boolean(filterPayment) ||
    Boolean(filterDistrict);

  const secondaryFilterCount = [
    filterType,
    filterCategory,
    filterFrom,
    filterTo,
    filterPayment,
    filterDistrict,
  ].filter(Boolean).length;

  function toggleSort(key: LedgerSortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "journey" ? "asc" : "desc");
  }

  function clearFilters() {
    setFilterType("");
    setFilterCategory("");
    setFilterFrom("");
    setFilterTo("");
    setFilterPayment("");
    setFilterDistrict("");
  }

  const filteredRows = useMemo(() => {
    const categoryNeedle = filterCategory.trim().toLowerCase();
    let list = ledgerEntries.filter(({ row, endpoints }) => {
      if (filterType && row.type !== filterType) return false;
      if (categoryNeedle && row.category.trim().toLowerCase() !== categoryNeedle) return false;
      if (filterFrom && endpoints.from !== filterFrom) return false;
      if (filterTo && endpoints.to !== filterTo) return false;
      if (filterPayment && row.payment_mode !== filterPayment) return false;
      if (filterDistrict && String(row.district_id ?? "") !== filterDistrict) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "date") {
        const cmp = a.row.txn_date.localeCompare(b.row.txn_date);
        if (cmp !== 0) return cmp * dir;
        return (a.row.id - b.row.id) * dir;
      }
      if (sortKey === "amount") {
        const cmp = a.row.amount - b.row.amount;
        if (cmp !== 0) return cmp * dir;
        return (a.row.id - b.row.id) * dir;
      }
      const aNum = a.row.journey_id ? (journeyById.get(a.row.journey_id)?.number ?? null) : null;
      const bNum = b.row.journey_id ? (journeyById.get(b.row.journey_id)?.number ?? null) : null;
      if (aNum == null && bNum == null) return (a.row.id - b.row.id) * dir;
      if (aNum == null) return 1;
      if (bNum == null) return -1;
      const cmp = aNum - bNum;
      if (cmp !== 0) return cmp * dir;
      return (a.row.id - b.row.id) * dir;
    });

    return list.map(({ row }) => row);
  }, [
    ledgerEntries,
    filterType,
    filterCategory,
    filterFrom,
    filterTo,
    filterPayment,
    filterDistrict,
    sortKey,
    sortDir,
    journeyById,
  ]);

  return (
    <div className="space-y-6">
      {loadError ? (
        <p className="rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm font-medium text-blue-dark">
          {loadError}
        </p>
      ) : null}

      <FinanceKpiCards
        rows={rows}
        categoryMetaByName={categoryMetaByName}
        variant={financeKpiVariant}
        wallets={financeKpiWallets}
      />

      <section className="surface overflow-hidden">
        {/* Mobile Filter & Sort Bar (md:hidden) */}
        <div className="flex items-center justify-between gap-1.5 border-b border-line bg-[var(--page)] p-2.5 md:hidden">
          {/* Sorting Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {([
              { key: "date", label: "Date" },
              { key: "amount", label: "Amt" },
              { key: "journey", label: "Jrny" },
            ] as const).map((opt) => {
              const isActive = sortKey === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleSort(opt.key)}
                  className={`flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs transition-all cursor-pointer ${
                    isActive
                      ? "border-[var(--brand)] bg-blue-soft text-blue-dark font-bold ring-1 ring-[var(--brand)]/30 shadow-xs"
                      : "border-line bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
                  }`}
                  aria-pressed={isActive}
                  title={`Sort by ${opt.label} (${isActive ? (sortDir === "asc" ? "ascending" : "descending") : "click to sort"})`}
                >
                  <span>{opt.label}</span>
                  {isActive ? (
                    sortDir === "asc" ? (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 stroke-[2.5]" fill="none" stroke="currentColor">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400 stroke-[2]" fill="none" stroke="currentColor">
                      <polyline points="7 15 12 20 17 15" />
                      <polyline points="7 9 12 4 17 9" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Filters Button */}
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className={`flex h-8 shrink-0 items-center gap-1.5 px-3 rounded-full border text-xs font-semibold transition-all shadow-xs ml-auto cursor-pointer ${
              secondaryFilterCount > 0
                ? "border-[var(--brand)] bg-blue-soft text-blue-dark font-bold ring-1 ring-[var(--brand)]/30"
                : "border-line bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Filters</span>
            {secondaryFilterCount > 0 ? (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-white">
                {secondaryFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Desktop Filter Bar (md:flex) */}
        <div className="hidden md:flex flex-wrap items-center gap-2 border-b border-line bg-[var(--page)] px-4 py-2.5">
          <div className="min-w-[7.5rem] max-w-[9.5rem] flex-1">
            <SelectField
              compact
              searchable
              autoSelectWhenSingle={false}
              value={filterType}
              onChange={setFilterType}
              placeholder="Type"
              options={[
                allFilterOption("All types"),
                { value: "in", label: "Money In" },
                { value: "out", label: "Money Out" },
                { value: "transfer", label: "Transfer" },
              ]}
            />
          </div>
          <div className="min-w-[7.5rem] max-w-[9.5rem] flex-1">
            <SelectField
              compact
              searchable
              autoSelectWhenSingle={false}
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="Category"
              options={[allFilterOption("All categories"), ...filterOptions.category]}
            />
          </div>
          <div className="min-w-[7.5rem] max-w-[9.5rem] flex-1">
            <SelectField
              compact
              searchable
              autoSelectWhenSingle={false}
              value={filterFrom}
              onChange={setFilterFrom}
              placeholder="From"
              options={[allFilterOption("All from"), ...filterOptions.from]}
            />
          </div>
          <div className="min-w-[7.5rem] max-w-[9.5rem] flex-1">
            <SelectField
              compact
              searchable
              autoSelectWhenSingle={false}
              value={filterTo}
              onChange={setFilterTo}
              placeholder="To"
              options={[allFilterOption("All to"), ...filterOptions.to]}
            />
          </div>
          <div className="min-w-[7.5rem] max-w-[9.5rem] flex-1">
            <SelectField
              compact
              searchable
              autoSelectWhenSingle={false}
              value={filterPayment}
              onChange={setFilterPayment}
              placeholder="Payment"
              options={[allFilterOption("All payments"), ...filterOptions.payment]}
            />
          </div>
          <div className="min-w-[7.5rem] max-w-[9.5rem] flex-1">
            <SelectField
              compact
              searchable
              autoSelectWhenSingle={false}
              value={filterDistrict}
              onChange={setFilterDistrict}
              placeholder="District"
              options={[allFilterOption("All districts"), ...filterOptions.district]}
            />
          </div>
          <div className="ml-auto flex items-center gap-2 pl-2">
            <span className="text-sm tabular-nums text-muted">{filteredRows.length} txns</span>
            {hasActiveFilters ? (
              <button
                type="button"
                className="btn-quiet px-2 py-1.5 text-xs whitespace-nowrap"
                onClick={clearFilters}
                title="Clear filters"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-white shadow-xs hover:bg-[var(--brand-dark)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="New transaction"
              aria-label="New transaction"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-soft text-blue">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <line x1="7" y1="9" x2="17" y2="9" />
                <line x1="7" y1="13" x2="13" y2="13" />
              </svg>
            </div>
            <p className="font-semibold text-slate-800">
              {hasActiveFilters ? "No matching transactions" : "No transactions recorded yet"}
            </p>
            <p className="mt-1 text-xs text-muted max-w-xs mx-auto">
              {hasActiveFilters
                ? "Try resetting filters or adjusting search parameters to see more entries."
                : "Tap the + button to record your first transaction."}
            </p>
            {hasActiveFilters ? (
              <div className="mt-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-quiet px-3 py-1.5 text-xs font-semibold"
                >
                  Reset filters
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {filteredRows.map((row) => {
                const endpoints = transactionLedgerEndpoints(row, accountName);
                const isIn = row.type === "in";
                const isOut = row.type === "out";
                return (
                  <li key={row.id} className="p-3.5 space-y-2 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                            isIn
                              ? "bg-emerald-100 text-emerald-700"
                              : isOut
                              ? "bg-rose-100 text-rose-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isIn ? "↓" : isOut ? "↑" : "⇄"}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`font-bold tabular-nums text-base leading-tight ${
                              isIn
                                ? "text-emerald-700"
                                : isOut
                                ? "text-slate-900"
                                : "text-blue-900"
                            }`}
                          >
                            {isIn ? "+" : isOut ? "−" : ""}
                            {formatAmount(row.amount)}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {row.txn_date} · <span className="font-medium text-slate-700">{txnTypeLabel(row.type)}</span>
                          </p>
                        </div>
                      </div>
                      <DeleteTxn id={row.id} />
                    </div>

                    <div className="rounded-lg bg-slate-50 p-2 text-xs border border-slate-100 flex items-center justify-between gap-2">
                      <div className="truncate min-w-0">
                        <span className="text-muted">From:</span>{" "}
                        <span className="font-medium text-slate-800">{endpoints.from}</span>
                      </div>
                      <span className="text-slate-400 shrink-0">→</span>
                      <div className="truncate min-w-0 text-right">
                        <span className="text-muted">To:</span>{" "}
                        <span className="font-medium text-slate-800">{endpoints.to}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {ledgerCategory(row)}
                      </span>
                      {row.payment_mode ? (
                        <span className="rounded bg-blue-soft px-2 py-0.5 font-medium text-blue-dark">
                          {row.payment_mode}
                        </span>
                      ) : null}
                      {row.district_id != null ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-muted">
                          {districtName(row.district_id)}
                        </span>
                      ) : null}
                      {row.journey_id ? (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                          {journeyLabel(row.journey_id)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-blue-soft text-blue-dark">
                  <tr>
                    <SortableLedgerHeader
                      label="Date"
                      sortKey="date"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <SortableLedgerHeader
                      label="Amount"
                      sortKey="amount"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">From Account/Party</th>
                    <th className="px-4 py-3 font-semibold">To Account/Party</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">District</th>
                    <SortableLedgerHeader
                      label="Journey"
                      sortKey="journey"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <th className="px-4 py-3 text-right font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const endpoints = transactionLedgerEndpoints(row, accountName);
                    return (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-4 py-3 whitespace-nowrap">{row.txn_date}</td>
                      <td className="px-4 py-3">{txnTypeLabel(row.type)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{formatAmount(row.amount)}</td>
                      <td className="px-4 py-3">{ledgerCategory(row)}</td>
                      <td className="px-4 py-3">{endpoints.from}</td>
                      <td className="px-4 py-3">{endpoints.to}</td>
                      <td className="px-4 py-3">{row.payment_mode || "—"}</td>
                      <td className="px-4 py-3">{districtName(row.district_id)}</td>
                      <td className="px-4 py-3">{row.journey_id ? journeyLabel(row.journey_id) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteTxn id={row.id} />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Floating Action Button (Freezed in bottom corner on mobile, above tabbar) */}
      <BodyPortal>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="finance-fab md:hidden flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-xl hover:opacity-95 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30 cursor-pointer"
          aria-label="New transaction"
          title="New transaction"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </BodyPortal>

      {filterSheetOpen ? (
        <MobileFilterSheet
          isOpen={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          filterType={filterType}
          setFilterType={setFilterType}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterFrom={filterFrom}
          setFilterFrom={setFilterFrom}
          filterTo={filterTo}
          setFilterTo={setFilterTo}
          filterPayment={filterPayment}
          setFilterPayment={setFilterPayment}
          filterDistrict={filterDistrict}
          setFilterDistrict={setFilterDistrict}
          filterOptions={filterOptions}
          typeCounts={typeCounts}
          filteredCount={filteredRows.length}
          hasActiveFilters={hasActiveFilters}
          onReset={clearFilters}
        />
      ) : null}

      {formOpen ? (
        <NewTransactionModal
          accounts={accounts}
          paymentModes={paymentModes}
          categories={categories}
          categoryScope={categoryScope}
          journeys={journeys}
          districts={districts}
          financialYears={financialYears}
          districtIdsByFinancialYear={districtIdsByFinancialYear}
          partyVendors={partyVendors}
          partyVendorRecords={partyVendorRecords}
          partySocieties={partySocieties}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}

function MobileFilterSheet({
  isOpen,
  onClose,
  filterType,
  setFilterType,
  filterCategory,
  setFilterCategory,
  filterFrom,
  setFilterFrom,
  filterTo,
  setFilterTo,
  filterPayment,
  setFilterPayment,
  filterDistrict,
  setFilterDistrict,
  filterOptions,
  typeCounts,
  filteredCount,
  hasActiveFilters,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  filterType: string;
  setFilterType: (val: string) => void;
  filterCategory: string;
  setFilterCategory: (val: string) => void;
  filterFrom: string;
  setFilterFrom: (val: string) => void;
  filterTo: string;
  setFilterTo: (val: string) => void;
  filterPayment: string;
  setFilterPayment: (val: string) => void;
  filterDistrict: string;
  setFilterDistrict: (val: string) => void;
  filterOptions: {
    category: { value: string; label: string }[];
    from: { value: string; label: string }[];
    to: { value: string; label: string }[];
    payment: { value: string; label: string }[];
    district: { value: string; label: string }[];
  };
  typeCounts: { all: number; inCount: number; outCount: number; transferCount: number };
  filteredCount: number;
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay
      className="z-[70] bg-slate-900/60 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl transition-all max-h-[min(calc(var(--modal-visible-height,100dvh)-1.5rem),740px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-filters-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="mobile-filters-title" className="text-base font-bold text-blue-dark">
              Filters
            </h2>
            <p className="text-xs text-muted">
              {filteredCount} matching {filteredCount === 1 ? "entry" : "entries"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 active:opacity-75 cursor-pointer"
              >
                Reset all
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close filters"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Body with Dropdowns for Each Filter */}
        <div className="modal-body-scroll min-h-0 flex-1 space-y-4 px-5 py-4 pb-6" data-modal-scroll>
          {/* 1. Transaction Flow */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Transaction Flow
              </label>
              {filterType ? (
                <button
                  type="button"
                  onClick={() => setFilterType("")}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <SelectField
              autoSelectWhenSingle={false}
              value={filterType}
              onChange={setFilterType}
              placeholder="All Flows"
              options={[
                { value: "", label: "All Flows" },
                { value: "in", label: "Money In (↓)" },
                { value: "out", label: "Money Out (↑)" },
                { value: "transfer", label: "Transfer (⇄)" },
              ]}
            />
          </div>

          {/* 2. Category */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Category
              </label>
              {filterCategory ? (
                <button
                  type="button"
                  onClick={() => setFilterCategory("")}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <SelectField
              searchable
              autoSelectWhenSingle={false}
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="All categories"
              options={[allFilterOption("All categories"), ...filterOptions.category]}
            />
          </div>

          {/* 3. Payment Mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Payment Mode
              </label>
              {filterPayment ? (
                <button
                  type="button"
                  onClick={() => setFilterPayment("")}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <SelectField
              searchable
              autoSelectWhenSingle={false}
              value={filterPayment}
              onChange={setFilterPayment}
              placeholder="All payment modes"
              options={[allFilterOption("All payment modes"), ...filterOptions.payment]}
            />
          </div>

          {/* 4. Source Account (From) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Source Account (From)
              </label>
              {filterFrom ? (
                <button
                  type="button"
                  onClick={() => setFilterFrom("")}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <SelectField
              searchable
              autoSelectWhenSingle={false}
              value={filterFrom}
              onChange={setFilterFrom}
              placeholder="All sources"
              options={[allFilterOption("All sources"), ...filterOptions.from]}
            />
          </div>

          {/* 5. Destination Account (To) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Destination (To)
              </label>
              {filterTo ? (
                <button
                  type="button"
                  onClick={() => setFilterTo("")}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <SelectField
              searchable
              autoSelectWhenSingle={false}
              value={filterTo}
              onChange={setFilterTo}
              placeholder="All destinations"
              options={[allFilterOption("All destinations"), ...filterOptions.to]}
            />
          </div>

          {/* 6. District (if present) */}
          {filterOptions.district.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  District
                </label>
                {filterDistrict ? (
                  <button
                    type="button"
                    onClick={() => setFilterDistrict("")}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <SelectField
                searchable
                autoSelectWhenSingle={false}
                value={filterDistrict}
                onChange={setFilterDistrict}
                placeholder="All districts"
                options={[allFilterOption("All districts"), ...filterOptions.district]}
              />
            </div>
          ) : null}

        </div>

        {/* Sticky Apply Button with Live Result Count */}
        <div className="border-t border-line bg-white p-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[var(--brand)] py-3 text-center text-sm font-bold text-white shadow-md hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Show {filteredCount} {filteredCount === 1 ? "Transaction" : "Transactions"}</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function NewTransactionModal({
  accounts,
  paymentModes,
  categories,
  journeys,
  districts,
  financialYears,
  districtIdsByFinancialYear,
  partyVendors,
  partyVendorRecords,
  partySocieties,
  categoryScope,
  onClose,
}: {
  accounts: TransactionAccountOption[];
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  categoryScope: "full" | "role";
  journeys: JourneyPickRow[];
  districts: NamedRow[];
  financialYears: FinancialYear[];
  districtIdsByFinancialYear: Record<number, number[]>;
  partyVendors: string[];
  partyVendorRecords: PartyVendorRecord[];
  partySocieties: string[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTransaction, null);
  const allowedTypes = useMemo(() => txnTypesForCategories(categories), [categories]);
  const typeOptions = useMemo(() => txnTypeSelectOptions(allowedTypes), [allowedTypes]);
  const [type, setType] = useState<TxnType>(() => defaultTxnTypeForCategories(categories));
  const [paymentMode, setPaymentMode] = useState("");
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [financialYearId, setFinancialYearId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [journeyId, setJourneyId] = useState("");
  const wasPendingRef = useRef(false);
  const [formKey, setFormKey] = useState(0);

  const categoryOptions = useMemo(
    () => categoriesForType(categories, type).map((cat) => ({ value: cat.name, label: cat.name })),
    [categories, type],
  );

  useEffect(() => {
    if (allowedTypes.length === 0) return;
    if (allowedTypes.includes(type)) return;
    setType(allowedTypes[0]);
    setCategoryName("");
    setFromValue("");
    setToValue("");
    setFinancialYearId("");
    setDistrictId("");
    setJourneyId("");
  }, [allowedTypes, type]);

  const fromMode = transactionEndpointMode(type, "from");
  const toMode = transactionEndpointMode(type, "to");

  const partyDistrictLabels = useMemo(
    () => districts.map((row) => row.label).filter(Boolean),
    [districts],
  );

  const selectedCategory = useMemo(
    () => categories.find((cat) => cat.name === categoryName) ?? null,
    [categories, categoryName],
  );

  const categoryPartyConfig = useMemo(
    () =>
      categoryPartyFieldConfig(
        categoryName,
        partyVendors,
        partyDistrictLabels,
        partySocieties,
        partyVendorRecords,
      ),
    [categoryName, partyVendors, partyDistrictLabels, partySocieties, partyVendorRecords],
  );

  const allocation = useMemo(() => {
    if (type === "transfer") {
      return {
        showDistrict: false,
        showJourney: false,
        requireDistrict: false,
        showFinancialYear: false,
        requireFinancialYear: false,
      };
    }
    return transactionAllocationFields(selectedCategory, type);
  }, [selectedCategory, type]);

  const financialYearOptions = useMemo(
    () => financialYears.map((year) => ({ value: String(year.id), label: year.label })),
    [financialYears],
  );

  const districtsForPicker = useMemo(() => {
    if (!allocation.showFinancialYear || !financialYearId) return districts;
    const fyId = Number(financialYearId);
    if (!Number.isFinite(fyId)) return districts;
    const allowed = new Set(districtIdsByFinancialYear[fyId] ?? []);
    if (allowed.size === 0) return districts;
    return districts.filter((district) => allowed.has(district.id));
  }, [allocation.showFinancialYear, districtIdsByFinancialYear, districts, financialYearId]);

  function handleCategoryChange(name: string) {
    setCategoryName(name);
    const cat = categories.find((row) => row.name === name);
    const next = transactionAllocationFields(cat ?? null, type);
    if (!next.showFinancialYear) {
      setFinancialYearId("");
    }
    if (!next.showDistrict) {
      setDistrictId("");
      setJourneyId("");
    } else if (!next.showJourney) {
      setJourneyId("");
    }
    if (fromMode === "party") setFromValue("");
    if (toMode === "party") setToValue("");

    const config = categoryPartyFieldConfig(
      name,
      partyVendors,
      partyDistrictLabels,
      partySocieties,
      partyVendorRecords,
    );
    if (config.enforceList && config.vendorsOnly && config.vendors.length === 1) {
      const only = config.vendors[0]!;
      if (fromMode === "party") setFromValue(only);
      if (toMode === "party") setToValue(only);
    }
  }

  function handleFinancialYearChange(value: string) {
    setFinancialYearId(value);
    setDistrictId("");
    setJourneyId("");
  }

  const accountsForPayment = useMemo(() => {
    if (!paymentMode) return [];
    if (isCashPaymentMode(paymentMode)) {
      return accounts.filter((account) => account.accountType === "wallet");
    }
    return accounts.filter((account) => account.accountType === "account");
  }, [accounts, paymentMode]);

  const accountSelectOptions = useMemo(
    () => accountsForPayment.map((account) => ({ value: String(account.id), label: account.label })),
    [accountsForPayment],
  );

  const allAccountSelectOptions = useMemo(
    () => accounts.map((account) => ({ value: String(account.id), label: account.label })),
    [accounts],
  );

  function accountOptionsForSide(side: "from" | "to") {
    if (type === "transfer" && side === "from") return allAccountSelectOptions;
    return accountSelectOptions;
  }

  function handlePaymentModeChange(value: string) {
    setPaymentMode(value);
    const allowedIds = new Set(
      accounts
        .filter((account) =>
          isCashPaymentMode(value)
            ? account.accountType === "wallet"
            : account.accountType === "account",
        )
        .map((account) => String(account.id)),
    );
    if (fromMode === "account" && fromValue && !allowedIds.has(fromValue)) setFromValue("");
    if (toMode === "account" && toValue && !allowedIds.has(toValue)) setToValue("");
  }

  function endpointPlaceholder(mode: TxnEndpointMode, side: "from" | "to") {
    if (mode === "party") {
      if (categoryPartyConfig.districtsOnly) return "Pick a district";
      if (categoryPartyConfig.societiesOnly) return "Type or pick a society";
      if (categoryPartyConfig.enforceList && categoryPartyConfig.vendorsOnly) {
        return categoryPartyConfig.vendors.length === 1 ? categoryPartyConfig.vendors[0]! : "Pick a vendor";
      }
      return "Type or pick from list";
    }
    if (!paymentMode) return "Select payment first";
    const options = accountOptionsForSide(side);
    if (options.length === 0) {
      return isCashPaymentMode(paymentMode) ? "Add a wallet in Masters" : "Add an account in Masters";
    }
    return isCashPaymentMode(paymentMode) ? "Select wallet" : "Select account";
  }

  function endpointDisabled(mode: TxnEndpointMode) {
    if (mode === "party") return false;
    return !paymentMode;
  }

  const journeyOptionsForDistrict = useMemo(() => {
    if (!districtId) return [];
    const id = Number(districtId);
    if (!Number.isFinite(id)) return [];
    return [...journeys]
      .filter((j) => j.districtIds.includes(id))
      .reverse()
      .map((j) => ({ value: j.id, label: journeyNumberLabel(j.number) }));
  }, [journeys, districtId]);

  function handleDistrictChange(value: string) {
    setDistrictId(value);
    setJourneyId("");
  }

  function handleJourneyChange(value: string) {
    setJourneyId(value);
  }

  useEffect(() => {
    if (wasPendingRef.current && !pending && state === null) {
      const isPcCategory = normalizeTransactionCategoryKey(categoryName) === "pc";
      if (isPcCategory) {
        const societyNames = new Set(partySocieties.map((name) => name.trim()).filter(Boolean));
        if (fromMode === "party") rememberPcCustomParty(fromValue, societyNames);
        if (toMode === "party") rememberPcCustomParty(toValue, societyNames);
      } else {
        const masterParties = masterPartyNameSet(partyVendors, partyDistrictLabels, partySocieties);
        if (fromMode === "party") rememberCustomParty(fromValue, masterParties);
        if (toMode === "party") rememberCustomParty(toValue, masterParties);
      }

      setFormKey((key) => key + 1);
      setType(defaultTxnTypeForCategories(categories));
      setPaymentMode("");
      setFromValue("");
      setToValue("");
      setCategoryName("");
      setFinancialYearId("");
      setDistrictId("");
      setJourneyId("");
      onClose();
    }
    wasPendingRef.current = pending;
  }, [
    pending,
    state,
    onClose,
    categories,
    fromMode,
    toMode,
    fromValue,
    toValue,
    partyVendors,
    partyDistrictLabels,
    partySocieties,
  ]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <ModalOverlay
      className="z-[70] bg-slate-900/60 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl transition-all max-h-[min(calc(var(--modal-visible-height,100dvh)-1.5rem),740px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-transaction-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 id="new-transaction-title" className="text-lg font-bold text-blue-dark">
            New transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form key={formKey} action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="category_scope" value={categoryScope} />
          <div className="modal-body-scroll min-h-0 flex-1 space-y-4 p-5" data-modal-scroll>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldStack label="Date">
                <DateField name="txn_date" required defaultValue={todayIsoDate()} />
              </FieldStack>
              <FieldStack label="Type">
                <SelectField
                  name="type"
                  required
                  value={type}
                  onChange={(value) => {
                    const nextType = value as TxnType;
                    setType(nextType);
                    setCategoryName("");
                    setFromValue("");
                    setToValue("");
                    setDistrictId("");
                    setJourneyId("");
                  }}
                  options={typeOptions}
                />
              </FieldStack>
              <FieldStack label="Payment">
                <SelectField
                  name="payment_mode"
                  required
                  searchable
                  value={paymentMode}
                  onChange={handlePaymentModeChange}
                  autoSelectWhenSingle={false}
                  placeholder="Select payment"
                  options={paymentModes.map((m) => ({ value: m.label, label: m.label }))}
                />
              </FieldStack>
              <FieldStack label="Category">
                <SelectField
                  key={type}
                  name="category"
                  required
                  searchable
                  value={categoryName}
                  onChange={handleCategoryChange}
                  autoSelectWhenSingle={false}
                  placeholder={
                    categoryOptions.length
                      ? "Select category"
                      : categories.length
                        ? "No categories for your role in Masters → Transactions"
                        : "Add categories in Masters"
                  }
                  options={categoryOptions}
                />
              </FieldStack>
              <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                <FieldStack label={<AccountPartyLabel side="from" type={type} />}>
                  <TransactionEndpointField
                    mode={fromMode}
                    side="from"
                    type={type}
                    paymentMode={paymentMode}
                    value={fromValue}
                    onChange={setFromValue}
                    placeholder={endpointPlaceholder(fromMode, "from")}
                    disabled={endpointDisabled(fromMode)}
                    accountOptions={accountOptionsForSide("from")}
                    partyVendors={partyVendors}
                    partyDistricts={partyDistrictLabels}
                    partySocieties={partySocieties}
                    categoryPartyConfig={categoryPartyConfig}
                  />
                </FieldStack>
                <FieldStack label={<AccountPartyLabel side="to" type={type} />}>
                  <TransactionEndpointField
                    mode={toMode}
                    side="to"
                    type={type}
                    paymentMode={paymentMode}
                    value={toValue}
                    onChange={setToValue}
                    placeholder={endpointPlaceholder(toMode, "to")}
                    disabled={endpointDisabled(toMode)}
                    accountOptions={accountOptionsForSide("to")}
                    partyVendors={partyVendors}
                    partyDistricts={partyDistrictLabels}
                    partySocieties={partySocieties}
                    categoryPartyConfig={categoryPartyConfig}
                  />
                </FieldStack>
              </div>
              {fromMode === "account" ? <input type="hidden" name="from_value" value={fromValue} /> : null}
              {toMode === "account" ? <input type="hidden" name="to_value" value={toValue} /> : null}
              <FieldStack label="Amount" className="sm:col-span-2">
                <input
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  required
                  aria-label="Amount"
                  className={inputClass}
                  placeholder="0"
                />
              </FieldStack>
              {type === "transfer" ? (
                <>
                  <input type="hidden" name="district_id" value="" />
                  <input type="hidden" name="journey_id" value="" />
                </>
              ) : (
                <>
                  {allocation.showFinancialYear ? (
                    <FieldStack label="Financial year" className="block space-y-1 sm:col-span-2">
                      <SelectField
                        name="financial_year_id"
                        required={allocation.requireFinancialYear}
                        searchable
                        value={financialYearId}
                        onChange={handleFinancialYearChange}
                        placeholder={
                          financialYears.length ? "Select financial year" : "Add FY in Vendor & Govt Rates"
                        }
                        options={financialYearOptions}
                      />
                    </FieldStack>
                  ) : (
                    <input type="hidden" name="financial_year_id" value="" />
                  )}
                  {allocation.showDistrict ? (
                    <FieldStack label="District" className="block space-y-1 sm:col-span-2">
                      <SelectField
                        name="district_id"
                        required={allocation.requireDistrict}
                        searchable
                        value={districtId}
                        onChange={handleDistrictChange}
                        disabled={allocation.showFinancialYear && !financialYearId}
                        placeholder={
                          allocation.showFinancialYear && !financialYearId
                            ? "Select financial year first"
                            : districtsForPicker.length
                              ? "Select district"
                              : "Add districts in Masters"
                        }
                        options={districtsForPicker.map((d) => ({ value: String(d.id), label: d.label }))}
                      />
                    </FieldStack>
                  ) : (
                    <>
                      <input type="hidden" name="district_id" value="" />
                      <input type="hidden" name="journey_id" value="" />
                    </>
                  )}
                  {allocation.showJourney ? (
                    <FieldStack label="Journey" className="block min-w-0 space-y-1 sm:col-span-2">
                      <SelectField
                        key={districtId || "no-district"}
                        name="journey_id"
                        searchable
                        value={journeyId}
                        onChange={handleJourneyChange}
                        disabled={!districtId}
                        autoSelectWhenSingle={false}
                        placeholder={
                          !districtId
                            ? "Select district first"
                            : journeyOptionsForDistrict.length
                              ? "None"
                              : "No journeys for this district"
                        }
                        options={journeyOptionsForDistrict}
                      />
                    </FieldStack>
                  ) : allocation.showDistrict ? (
                    <input type="hidden" name="journey_id" value="" />
                  ) : null}
                </>
              )}
              <FieldStack label="Remarks" className="block space-y-1 sm:col-span-2">
                <input name="remarks" aria-label="Remarks" className={inputClass} placeholder="Optional" />
              </FieldStack>
            </div>
            {state?.error ? <p className="text-sm font-medium text-red-600">{state.error}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            <button type="button" onClick={onClose} className="btn-quiet" disabled={pending}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-primary shrink-0">
              {pending ? "Saving…" : "Save transaction"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function ledgerCategory(row: TransactionRow) {
  return row.category || "—";
}

function DeleteTxn({ id }: { id: number }) {
  return (
    <form action={deleteTransaction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="shrink-0 py-1 text-sm font-semibold text-blue hover:underline">
        Remove
      </button>
    </form>
  );
}
