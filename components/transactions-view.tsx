"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createTransaction, deleteTransaction, type FormState } from "@/app/(workspace)/finance/actions";
import { DateField } from "@/components/date-field";
import { FinanceKpiCards } from "@/components/finance-kpi-cards";
import { PartyField } from "@/components/party-field";
import { SelectField } from "@/components/select-field";
import { masterPartyNameSet, rememberCustomParty } from "@/lib/finance-party-memory";
import type { CategoryMeta, FinanceKpiWallet } from "@/lib/finance-kpi";
import type { FinanceKpiVariant } from "@/lib/finance-kpi";
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
        vendors={partyVendors}
        districts={partyDistricts}
        societies={partySocieties}
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
  partySocieties,
  categoryMetaByName,
  financeKpiVariant,
  financeKpiWallets,
  categoryScope,
  ledgerAccountLabelById = {},
  loadError,
}: {
  rows: TransactionRow[];
  accounts: TransactionAccountOption[];
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  journeys: JourneyPickRow[];
  districts: NamedRow[];
  partyVendors: string[];
  partySocieties: string[];
  categoryMetaByName: Record<string, CategoryMeta>;
  financeKpiVariant: FinanceKpiVariant;
  financeKpiWallets: FinanceKpiWallet[];
  categoryScope: "full" | "role";
  ledgerAccountLabelById?: Record<number, string>;
  loadError: string | null;
}) {
  const [formOpen, setFormOpen] = useState(false);
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
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-line bg-[var(--page)] px-3 py-2">
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 grow basis-[7rem] items-center sm:basis-0">
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
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 grow basis-[7rem] items-center sm:basis-0">
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
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 grow basis-[7rem] items-center sm:basis-0">
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
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 grow basis-[7rem] items-center sm:basis-0">
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
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 grow basis-[7rem] items-center sm:basis-0">
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
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 grow basis-[7rem] items-center sm:basis-0">
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
          <div className="flex min-h-[38px] min-w-[6.5rem] max-w-[9rem] shrink-0 items-center md:hidden">
            <SelectField
              compact
              autoSelectWhenSingle={false}
              value={`${sortKey}:${sortDir}`}
              onChange={(value) => {
                const [key, dir] = value.split(":") as [LedgerSortKey, SortDir];
                setSortKey(key);
                setSortDir(dir);
              }}
              placeholder="Sort"
              options={[
                { value: "date:desc", label: "Date · newest" },
                { value: "date:asc", label: "Date · oldest" },
                { value: "amount:desc", label: "Amount · high" },
                { value: "amount:asc", label: "Amount · low" },
                { value: "journey:asc", label: "Journey · low" },
                { value: "journey:desc", label: "Journey · high" },
              ]}
            />
          </div>
          <div className="ml-auto flex h-[38px] shrink-0 items-center gap-2 pl-2">
            <span className="text-sm tabular-nums leading-none text-muted">{filteredRows.length}</span>
            {hasActiveFilters ? (
              <button
                type="button"
                className="btn-quiet px-2 py-1.5 text-xs leading-none whitespace-nowrap"
                onClick={clearFilters}
                title="Clear filters"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white hover:opacity-90"
              aria-label="New transaction"
              onClick={() => setFormOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No transactions yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {filteredRows.map((row) => {
                const endpoints = transactionLedgerEndpoints(row, accountName);
                return (
                  <li key={row.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{formatAmount(row.amount)}</p>
                        <p className="text-sm text-muted">
                          {row.txn_date} · {txnTypeLabel(row.type)}
                        </p>
                      </div>
                      <DeleteTxn id={row.id} />
                    </div>
                    <p className="text-sm">{ledgerCategory(row)}</p>
                    <p className="text-sm">
                      From {endpoints.from} → To {endpoints.to}
                    </p>
                    {row.district_id != null ? (
                      <p className="text-sm text-[var(--text-secondary)]">{districtName(row.district_id)}</p>
                    ) : null}
                    {row.journey_id ? (
                      <p className="text-sm text-[var(--text-secondary)]">{journeyLabel(row.journey_id)}</p>
                    ) : null}
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

      {formOpen ? (
        <NewTransactionModal
          accounts={accounts}
          paymentModes={paymentModes}
          categories={categories}
          categoryScope={categoryScope}
          journeys={journeys}
          districts={districts}
          partyVendors={partyVendors}
          partySocieties={partySocieties}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}

function NewTransactionModal({
  accounts,
  paymentModes,
  categories,
  journeys,
  districts,
  partyVendors,
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
  partyVendors: string[];
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

  const allocation = useMemo(() => {
    if (type === "transfer") {
      return { showDistrict: false, showJourney: false, requireDistrict: false };
    }
    return transactionAllocationFields(selectedCategory);
  }, [selectedCategory, type]);

  function handleCategoryChange(name: string) {
    setCategoryName(name);
    const cat = categories.find((row) => row.name === name);
    const next = transactionAllocationFields(cat ?? null);
    if (!next.showDistrict) {
      setDistrictId("");
      setJourneyId("");
    } else if (!next.showJourney) {
      setJourneyId("");
    }
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
    if (mode === "party") return "Type or pick from list";
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
      const masterParties = masterPartyNameSet(partyVendors, partyDistrictLabels, partySocieties);
      if (fromMode === "party") rememberCustomParty(fromValue, masterParties);
      if (toMode === "party") rememberCustomParty(toValue, masterParties);

      setFormKey((key) => key + 1);
      setType(defaultTxnTypeForCategories(categories));
      setPaymentMode("");
      setFromValue("");
      setToValue("");
      setCategoryName("");
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-blue-dark/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-transaction-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-line bg-white px-5 py-4">
          <h2 id="new-transaction-title" className="text-lg font-bold text-blue-dark">
            New transaction
          </h2>
        </div>
        <form key={formKey} action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="category_scope" value={categoryScope} />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
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
                  {allocation.showDistrict ? (
                    <FieldStack label="District" className="block space-y-1 sm:col-span-2">
                      <SelectField
                        name="district_id"
                        required={allocation.requireDistrict}
                        searchable
                        value={districtId}
                        onChange={handleDistrictChange}
                        placeholder={districts.length ? "Select district" : "Add districts in Masters"}
                        options={districts.map((d) => ({ value: String(d.id), label: d.label }))}
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
    </div>
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
