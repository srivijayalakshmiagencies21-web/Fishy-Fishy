"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createTransaction, deleteTransaction, type FormState } from "@/app/(workspace)/finance/actions";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import type { NamedRow, TransactionCategoryRow } from "@/lib/masters";
import {
  categoriesForType,
  formatAmount,
  journeyPickLabel,
  todayIsoDate,
  txnTypeLabel,
  type JourneyPickRow,
  type TransactionRow,
  type TxnType,
} from "@/lib/transactions";

const inputClass = "input-field";

function FieldStack({
  label,
  className = "block space-y-1",
  children,
}: {
  label: string;
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
  loadError,
}: {
  rows: TransactionRow[];
  accounts: NamedRow[];
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  journeys: JourneyPickRow[];
  loadError: string | null;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [filterType, setFilterType] = useState("");

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.label]));
    return (id: number) => map.get(id) ?? "—";
  }, [accounts]);

  const journeyLabel = useMemo(() => {
    const map = new Map(journeys.map((j) => [j.id, j]));
    return (id: string | null) => {
      if (!id) return "";
      const journey = map.get(id);
      return journey ? journeyPickLabel(journey) : "—";
    };
  }, [journeys]);

  const journeyOptions = useMemo(
    () =>
      [...journeys]
        .reverse()
        .map((j) => ({ value: j.id, label: journeyPickLabel(j) })),
    [journeys],
  );

  const filteredRows = useMemo(() => {
    if (!filterType) return rows;
    return rows.filter((row) => row.type === filterType);
  }, [rows, filterType]);

  return (
    <div className="space-y-6">
      {loadError ? (
        <p className="rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm font-medium text-blue-dark">
          {loadError}
        </p>
      ) : null}

      <section className="surface overflow-hidden">
        <div className="flex flex-nowrap items-center gap-2 border-b border-line px-4 py-3">
          <p className="shrink-0 text-sm font-semibold whitespace-nowrap text-blue-dark">
            Ledger <span className="font-normal text-muted">({filteredRows.length})</span>
          </p>
          <div className="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-2">
            <div className="w-[7.25rem] shrink sm:w-auto sm:min-w-[9.5rem]">
              <SelectField
                compact
                defaultValue=""
                onChange={setFilterType}
                options={[
                  { value: "", label: "All types" },
                  { value: "in", label: "Money In" },
                  { value: "out", label: "Money Out" },
                  { value: "transfer", label: "Transfer" },
                ]}
              />
            </div>
            <button
              type="button"
              className="btn-primary shrink-0 px-3 py-2 text-sm whitespace-nowrap"
              onClick={() => setFormOpen(true)}
            >
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New transaction</span>
            </button>
          </div>
        </div>
        {filteredRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No transactions yet.</p>
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {filteredRows.map((row) => (
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
                  <p className="text-sm text-[var(--text-secondary)]">{accountLine(row, accountName)}</p>
                  {row.journey_id ? (
                    <p className="text-sm text-[var(--text-secondary)]">{journeyLabel(row.journey_id)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-blue-soft text-blue-dark">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Journey</th>
                    <th className="px-4 py-3 text-right font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-4 py-3 whitespace-nowrap">{row.txn_date}</td>
                      <td className="px-4 py-3">{txnTypeLabel(row.type)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{formatAmount(row.amount)}</td>
                      <td className="px-4 py-3">{ledgerCategory(row)}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{accountLine(row, accountName)}</td>
                      <td className="px-4 py-3">{row.payment_mode || "—"}</td>
                      <td className="px-4 py-3">{row.journey_id ? journeyLabel(row.journey_id) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteTxn id={row.id} />
                      </td>
                    </tr>
                  ))}
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
          journeyOptions={journeyOptions}
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
  journeyOptions,
  onClose,
}: {
  accounts: NamedRow[];
  paymentModes: NamedRow[];
  categories: TransactionCategoryRow[];
  journeyOptions: { value: string; label: string }[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTransaction, null);
  const [type, setType] = useState<TxnType>("out");
  const wasPendingRef = useRef(false);
  const formKey = useRef(0);

  const categoryOptions = useMemo(
    () => categoriesForType(categories, type).map((cat) => ({ value: cat.name, label: cat.name })),
    [categories, type],
  );

  const showTransferTo = type === "transfer";
  const primaryAccountLabel =
    type === "in" ? "To Account" : type === "transfer" ? "From account" : "From Account";

  useEffect(() => {
    if (wasPendingRef.current && !pending && state === null) {
      formKey.current += 1;
      setType("out");
      onClose();
    }
    wasPendingRef.current = pending;
  }, [pending, state, onClose]);

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
        <form key={formKey.current} action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldStack label="Date">
                <DateField name="txn_date" required defaultValue={todayIsoDate()} />
              </FieldStack>
              <FieldStack label="Type">
                <SelectField
                  name="type"
                  required
                  defaultValue="out"
                  onChange={(value) => setType(value as TxnType)}
                  options={[
                    { value: "out", label: "Money Out" },
                    { value: "in", label: "Money In" },
                    { value: "transfer", label: "Transfer" },
                  ]}
                />
              </FieldStack>
              <FieldStack label={primaryAccountLabel} className="block space-y-1 sm:col-span-2">
                <SelectField
                  name="account_id"
                  required
                  defaultValue=""
                  placeholder="Select account"
                  options={accounts.map((a) => ({ value: String(a.id), label: a.label }))}
                />
              </FieldStack>
              {showTransferTo ? (
                <FieldStack label="To account" className="block space-y-1 sm:col-span-2">
                  <SelectField
                    name="to_account_id"
                    required
                    defaultValue=""
                    placeholder="Select account"
                    options={accounts.map((a) => ({ value: String(a.id), label: a.label }))}
                  />
                </FieldStack>
              ) : (
                <input type="hidden" name="to_account_id" value="" />
              )}
              <FieldStack label="Amount">
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
              <FieldStack label="Category">
                <SelectField
                  key={type}
                  name="category"
                  required
                  defaultValue=""
                  placeholder={categoryOptions.length ? "Select category" : "Add categories in Masters"}
                  options={categoryOptions}
                />
              </FieldStack>
              <FieldStack label="Payment">
                <SelectField
                  name="payment_mode"
                  required
                  defaultValue=""
                  placeholder="Select payment"
                  options={paymentModes.map((m) => ({ value: m.label, label: m.label }))}
                />
              </FieldStack>
              {showTransferTo ? (
                <>
                  <input type="hidden" name="party" value="" />
                  <input type="hidden" name="journey_id" value="" />
                </>
              ) : (
                <>
                  <FieldStack label="Party" className="block min-w-0 space-y-1">
                    <input
                      name="party"
                      aria-label="Party"
                      className={inputClass}
                      placeholder="Vendor, client, or note"
                    />
                  </FieldStack>
                  <FieldStack label="Journey" className="block min-w-0 space-y-1 sm:col-span-2">
                    <SelectField name="journey_id" defaultValue="" placeholder="None" options={journeyOptions} />
                  </FieldStack>
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

function accountLine(row: TransactionRow, accountName: (id: number) => string) {
  if (row.type === "transfer" && row.to_account_id) {
    return `${accountName(row.account_id)} → ${accountName(row.to_account_id)}`;
  }
  return accountName(row.account_id);
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
