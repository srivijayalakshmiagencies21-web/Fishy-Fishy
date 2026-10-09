"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/app/(workspace)/masters/actions";
import {
  addSociety,
  createAccount,
  createDistrict,
  createFish,
  createPaymentMode,
  createTransactionCategory,
  createVendor,
  deleteAccount,
  deleteDistrict,
  deleteFish,
  deleteTransactionCategory,
  deletePaymentMode,
  deleteSociety,
  deleteVendor,
  tagCompany,
  unlinkCompany,
  updateTransactionCategory,
} from "@/app/(workspace)/masters/actions";
import { SelectField } from "@/components/select-field";
import type {
  DistrictRow,
  FishRow,
  MasterData,
  NamedRow,
  TransactionCategoryRow,
  VendorRow,
} from "@/lib/masters";
import { mobileDigits, MOBILE_DIGITS } from "@/lib/phone";

const inputClass = "input-field";

const COST_NATURES = [
  "Direct",
  "Overhead",
  "Revenue",
  "Non-Cost",
] as const;

function transactionTypeLabel(value: TransactionCategoryRow["transaction_type"]) {
  if (value === "in") return "Money In";
  if (value === "out") return "Money Out";
  return "Transfer";
}

function allocationLabel(value: TransactionCategoryRow["default_allocation"]) {
  if (value === "company") return "Company";
  if (value === "project") return "Journey";
  return "Ask each time";
}

const DEFAULT_ALLOCATION_OPTIONS = [
  { value: "company", label: "Company" },
  { value: "ask", label: "Ask each time" },
  { value: "project", label: "Journey" },
] as const;

function categoryMeta(row: TransactionCategoryRow) {
  return `${transactionTypeLabel(row.transaction_type)} · ${row.cost_nature} · ${allocationLabel(row.default_allocation)}`;
}

export function MasterPanel({
  data,
  notice,
}: {
  data: MasterData;
  notice: string | null;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {notice ? <Notice message={notice} /> : null}
      {data.error ? <Notice message={data.error} /> : null}
      {data.kind === "accounts" ? (
        <NamedMaster
          fieldName="name"
          fieldLabel="Account name"
          action={createAccount}
          deleteAction={deleteAccount}
          rows={data.rows}
          empty="No accounts yet."
        />
      ) : null}
      {data.kind === "payment-modes" ? (
        <NamedMaster
          fieldName="mode"
          fieldLabel="Payment"
          action={createPaymentMode}
          deleteAction={deletePaymentMode}
          rows={data.rows}
          empty="No payments yet."
        />
      ) : null}
      {data.kind === "transactions" ? <TransactionCategoriesMaster rows={data.rows} /> : null}
      {data.kind === "vendors" ? <VendorMaster rows={data.rows} /> : null}
      {data.kind === "fishes" ? <FishMaster rows={data.rows} /> : null}
      {data.kind === "districts" ? <DistrictMaster rows={data.rows} /> : null}
    </div>
  );
}

function Notice({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-line bg-blue-soft px-4 py-3 text-sm font-medium text-blue-dark">
      {message}
    </p>
  );
}

function TransactionCategoriesMaster({ rows }: { rows: TransactionCategoryRow[] }) {
  const [state, formAction, pending] = useActionState(createTransactionCategory, null);
  const [editRow, setEditRow] = useState<TransactionCategoryRow | null>(null);
  return (
    <>
      <EntryCard>
        <form action={formAction} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] xl:items-end">
            <label className="block min-w-0 space-y-1 md:col-span-2 xl:col-span-1">
              <span className="label">Category name</span>
              <input name="name" required className={inputClass} placeholder="e.g. Office rent" />
            </label>
            <label className="block min-w-0 space-y-1">
              <span className="label">Transaction type</span>
              <SelectField
                name="transaction_type"
                required
                defaultValue="out"
                options={[
                  { value: "out", label: "Money Out" },
                  { value: "in", label: "Money In" },
                  { value: "both", label: "Transfer" },
                ]}
              />
            </label>
            <label className="block min-w-0 space-y-1">
              <span className="label">Cost nature</span>
              <SelectField
                name="cost_nature"
                required
                defaultValue="Direct"
                options={COST_NATURES.map((value) => ({ value, label: value }))}
              />
            </label>
            <label className="block min-w-0 space-y-1">
              <span className="label">Default allocation</span>
              <SelectField
                name="default_allocation"
                required
                defaultValue="ask"
                options={[...DEFAULT_ALLOCATION_OPTIONS]}
              />
            </label>
            <div className="md:col-span-2 xl:col-span-1 xl:justify-self-end">
              <button type="submit" disabled={pending} className="btn-primary w-full md:w-auto">
                {pending ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
          {state?.error ? <p className="text-sm font-medium text-red-600">{state.error}</p> : null}
        </form>
      </EntryCard>

      <RowsCard empty="No transaction categories yet." count={rows.length}>
        <ul className="divide-y divide-line md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{row.name}</p>
                <p className="text-sm text-muted">{categoryMeta(row)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" className="pill pill-blue" onClick={() => setEditRow(row)}>
                  Edit
                </button>
                <DeleteButton action={deleteTransactionCategory} id={row.id} label={row.name} />
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-0 text-left text-sm">
            <thead className="bg-blue-soft text-blue-dark">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Setup</th>
                <th className="px-4 py-3 text-right font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{categoryMeta(row)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="pill pill-blue" onClick={() => setEditRow(row)}>
                        Edit
                      </button>
                      <DeleteButton action={deleteTransactionCategory} id={row.id} label={row.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RowsCard>

      {editRow ? (
        <TransactionCategoryModal row={editRow} onClose={() => setEditRow(null)} />
      ) : null}
    </>
  );
}

function TransactionCategoryModal({
  row,
  onClose,
}: {
  row: TransactionCategoryRow;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateTransactionCategory, null);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending && state === null) onClose();
    wasPendingRef.current = pending;
  }, [pending, state, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-dark/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white shadow-xl">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-blue-dark">Edit transaction category</h2>
        </div>
        <form action={formAction} className="space-y-4 p-5">
          <input type="hidden" name="id" value={row.id} />
          <label className="block space-y-1">
            <span className="label">Category name</span>
            <input name="name" required defaultValue={row.name} className={inputClass} />
          </label>
          <label className="block space-y-1">
            <span className="label">Transaction type</span>
            <SelectField
              name="transaction_type"
              required
              defaultValue={row.transaction_type}
              options={[
                { value: "out", label: "Money Out" },
                { value: "in", label: "Money In" },
                { value: "both", label: "Transfer" },
              ]}
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Cost nature</span>
            <SelectField
              name="cost_nature"
              required
              defaultValue={row.cost_nature}
              options={COST_NATURES.map((value) => ({ value, label: value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Default allocation</span>
            <SelectField
              name="default_allocation"
              required
              defaultValue={row.default_allocation}
              options={[...DEFAULT_ALLOCATION_OPTIONS]}
            />
          </label>
          <FormFooter error={state?.error} pending={pending} label="Save" />
        </form>
        <div className="border-t border-line bg-page px-5 py-3 text-right">
          <button type="button" onClick={onClose} className="btn-quiet">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function NamedMaster({
  fieldName,
  fieldLabel,
  action,
  deleteAction,
  rows,
  empty,
}: {
  fieldName: string;
  fieldLabel: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  rows: NamedRow[];
  empty: string;
}) {
  return (
    <>
      <EntryCard>
        <SingleFieldForm action={action} name={fieldName} label={fieldLabel} />
      </EntryCard>
      <RowsCard empty={empty} count={rows.length}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-0 text-left text-sm">
          <thead className="bg-blue-soft text-blue-dark">
            <tr>
              <th className="px-4 py-3 font-semibold">{fieldLabel}</th>
              <th className="px-4 py-3 text-right font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton action={deleteAction} id={row.id} label={row.label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </RowsCard>
    </>
  );
}

function VendorMaster({ rows }: { rows: VendorRow[] }) {
  const [state, action, pending] = useActionState(createVendor, null);

  return (
    <>
      <EntryCard>
        <form action={action} className="flex flex-wrap items-end gap-4">
          <Field label="Vendor name" name="name" />
          <label className="block min-w-[200px] flex-1 space-y-1">
            <span className="label">Contact number</span>
            <input
              name="contact_number"
              type="tel"
              inputMode="numeric"
              maxLength={MOBILE_DIGITS}
              pattern="\d{10}"
              title="Enter a 10-digit mobile number"
              required
              onChange={(e) => {
                e.currentTarget.value = mobileDigits(e.currentTarget.value);
              }}
              className={inputClass}
            />
          </label>
          <label className="block min-w-[200px] flex-1 space-y-1">
            <span className="label">Vendor type</span>
            <SelectField
              name="vendor_type"
              required
              defaultValue="Supplier"
              options={[
                { value: "Supplier", label: "Supplier" },
                { value: "Transporter", label: "Transporter" },
              ]}
            />
          </label>
          <FormFooter error={state?.error} pending={pending} />
        </form>
      </EntryCard>
      <RowsCard empty="No vendors yet." count={rows.length}>
        <ul className="divide-y divide-line md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{row.name}</p>
                <p className="text-sm text-muted">{row.contactNumber}</p>
                <p className="text-sm">{row.vendorType}</p>
              </div>
              <DeleteButton action={deleteVendor} id={row.id} label={row.name} />
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-blue-soft text-blue-dark">
            <tr>
              <th className="px-4 py-3 font-semibold">Vendor</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3">{row.contactNumber}</td>
                <td className="px-4 py-3">{row.vendorType}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton action={deleteVendor} id={row.id} label={row.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </RowsCard>
    </>
  );
}

function FishMaster({ rows }: { rows: FishRow[] }) {
  const [state, action, pending] = useActionState(createFish, null);

  return (
    <>
      <EntryCard>
        <form action={action} className="flex flex-wrap items-end gap-4">
          <Field label="Fish type" name="fish_type" />
          <Field label="Seed size" name="seed_size" />
          <FormFooter error={state?.error} pending={pending} />
        </form>
      </EntryCard>
      <RowsCard empty="No fishes yet." count={rows.length}>
        <ul className="divide-y divide-line md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{row.fishType}</p>
                <p className="text-sm text-muted">{row.seedSize}</p>
              </div>
              <DeleteButton action={deleteFish} id={row.id} label={row.fishType} />
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-blue-soft text-blue-dark">
            <tr>
              <th className="px-4 py-3 font-semibold">Fish type</th>
              <th className="px-4 py-3 font-semibold">Seed size</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{row.fishType}</td>
                <td className="px-4 py-3">{row.seedSize}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton action={deleteFish} id={row.id} label={row.fishType} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </RowsCard>
    </>
  );
}

function DistrictMaster({ rows }: { rows: DistrictRow[] }) {
  const [state, action, pending] = useActionState(createDistrict, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <>
      <EntryCard>
        <form ref={formRef} action={action} className="flex flex-wrap items-end gap-4">
          <Field label="District name" name="name" />
          <FormFooter error={state?.error} pending={pending} />
        </form>
      </EntryCard>
      {rows.length === 0 ? (
        <RowsCard empty="No districts yet." count={0}>
          <span />
        </RowsCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((district) => (
            <DistrictCard key={district.id} district={district} />
          ))}
        </div>
      )}
    </>
  );
}

function DistrictCard({ district }: { district: DistrictRow }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section className="surface flex flex-col justify-between p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-bold break-words text-blue-dark">{district.name}</h2>
          <button type="button" className="pill pill-blue shrink-0" onClick={() => setIsModalOpen(true)}>
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-line/60 pt-4">
          <div>
            <h3 className="mb-2 text-[0.65rem] font-bold tracking-widest text-muted uppercase">Societies ({district.societies.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {district.societies.length > 0 ? (
                district.societies.map((s) => (
                  <span key={s.id} className="inline-flex items-center rounded bg-blue-soft/50 px-2 py-1 text-xs font-medium text-blue-dark">
                    {s.label}
                  </span>
                ))
              ) : (
                <span className="text-xs italic text-muted">None</span>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[0.65rem] font-bold tracking-widest text-muted uppercase">Companies ({district.companies.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {district.companies.length > 0 ? (
                district.companies.map((c) => (
                  <span key={c.id} className="inline-flex items-center rounded bg-blue-soft/50 px-2 py-1 text-xs font-medium text-blue-dark">
                    {c.label}
                  </span>
                ))
              ) : (
                <span className="text-xs italic text-muted">None</span>
              )}
            </div>
          </div>
        </div>
      </section>
      {isModalOpen ? <DistrictModal district={district} onClose={() => setIsModalOpen(false)} /> : null}
    </>
  );
}

function DistrictModal({ district, onClose }: { district: DistrictRow, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-dark/40 p-4 backdrop-blur-sm">
      <div className="surface flex max-h-full w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-line bg-blue-soft/30 px-5 py-4">
          <h2 className="text-lg font-bold text-blue-dark">Edit {district.name}</h2>
          <div className="flex items-center gap-3">
            <DeleteButton action={deleteDistrict} id={district.id} label={district.name} />
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-black/5 hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-blue-dark">Societies</h3>
                <p className="text-xs text-muted">Add or remove societies</p>
              </div>
              <InlineAdd action={addSociety} districtId={district.id} fieldName="society_name" placeholder="Society name" />
              <ul className="mt-4 space-y-2">
                {district.societies.map((society) => (
                  <li key={society.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-page px-3 py-2 text-sm">
                    <span className="font-medium break-words">{society.label}</span>
                    <DeleteButton action={deleteSociety} id={society.id} label={society.label} />
                  </li>
                ))}
                {district.societies.length === 0 ? (
                  <li className="text-sm text-muted">No societies added yet.</li>
                ) : null}
              </ul>
            </div>

            <div>
              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-blue-dark">Companies</h3>
                <p className="text-xs text-muted">Tag or unlink companies</p>
              </div>
              <InlineAdd action={tagCompany} districtId={district.id} fieldName="company_name" placeholder="Company name" />
              <ul className="mt-4 space-y-2">
                {district.companies.map((company) => (
                  <li key={company.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-page px-3 py-2 text-sm">
                    <span className="font-medium break-words">{company.label}</span>
                    <form action={unlinkCompany}>
                      <input type="hidden" name="district_id" value={district.id} />
                      <input type="hidden" name="company_id" value={company.id} />
                      <button type="submit" className="shrink-0 py-1 text-sm font-semibold text-blue hover:underline">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
                {district.companies.length === 0 ? (
                  <li className="text-sm text-muted">No companies tagged yet.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="border-t border-line bg-page px-5 py-3 text-right">
          <button type="button" onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineAdd({
  action,
  districtId,
  fieldName,
  placeholder,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  districtId: number;
  fieldName: string;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state === null) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="relative m-0">
      <div className="flex w-full items-center gap-2">
        <input type="hidden" name="district_id" value={districtId} />
        <input name={fieldName} required placeholder={placeholder} className={`${inputClass} flex-1 !min-h-[36px] !py-1.5 !px-3 !text-sm`} />
        <button type="submit" disabled={pending} className="btn-primary shrink-0 !min-h-[36px] !px-4 !text-sm">
          {pending ? "…" : "Add"}
        </button>
      </div>
      {state?.error ? <p className="absolute top-full mt-1 w-full text-xs font-medium text-red-600">{state.error}</p> : null}
    </form>
  );
}

function SingleFieldForm({
  action,
  name,
  label,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  name: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <Field label={label} name={name} />
      <FormFooter error={state?.error} pending={pending} />
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-[200px] flex-1 space-y-1">
      <span className="label">{label}</span>
      <input name={name} type={type} required={required} className={inputClass} />
    </label>
  );
}

function FormFooter({ error, pending, label = "Add" }: { error?: string; pending: boolean; label?: string }) {
  return (
    <>
      <button type="submit" disabled={pending} className="btn-primary shrink-0">
        {pending ? "Saving…" : label}
      </button>
      {error ? <p className="w-full text-sm font-medium text-red-600">{error}</p> : null}
    </>
  );
}

function EntryCard({ children }: { children: React.ReactNode }) {
  return <section className="surface p-4 sm:p-5">{children}</section>;
}

function RowsCard({
  children,
  empty,
  count,
}: {
  children: React.ReactNode;
  empty: string;
  count: number;
}) {
  return (
    <section className="surface overflow-hidden">
      {count === 0 ? <p className="px-4 py-8 text-sm text-muted">{empty}</p> : children}
    </section>
  );
}

function DeleteButton({
  action,
  id,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  id: number;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="shrink-0 py-1 text-sm font-semibold text-blue hover:underline" aria-label={`Remove ${label}`}>
        Remove
      </button>
    </form>
  );
}
