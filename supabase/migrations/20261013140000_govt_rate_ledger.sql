-- Govt rates ledger: FY + district + company with rate and recorded quantity.

create table public.govt_rate_ledger (
  id bigint generated always as identity primary key,
  financial_year_id bigint not null references public.financial_years (id) on delete restrict,
  district_id bigint not null references public.districts (id) on delete restrict,
  company_id bigint not null references public.companies (id) on delete restrict,
  rate numeric,
  govt_recorded_qty numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint govt_rate_ledger_unique unique (financial_year_id, district_id, company_id),
  constraint govt_rate_ledger_rate_nonneg check (rate is null or rate >= 0),
  constraint govt_rate_ledger_qty_nonneg check (govt_recorded_qty is null or govt_recorded_qty >= 0)
);

create index govt_rate_ledger_financial_year_id_idx on public.govt_rate_ledger (financial_year_id);

comment on table public.govt_rate_ledger is 'Vendor & Govt Rates — ledger rows per FY, district, and company.';

alter table public.govt_rate_ledger enable row level security;

grant select, insert, update, delete on table public.govt_rate_ledger to authenticated;
grant all on public.govt_rate_ledger to service_role;

create policy govt_rate_ledger_select on public.govt_rate_ledger
  for select to authenticated
  using (true);

create policy govt_rate_ledger_insert on public.govt_rate_ledger
  for insert to authenticated
  with check ((select private.can_write_vendor_govt_rates()));

create policy govt_rate_ledger_update on public.govt_rate_ledger
  for update to authenticated
  using ((select private.can_write_vendor_govt_rates()))
  with check ((select private.can_write_vendor_govt_rates()));

create policy govt_rate_ledger_delete on public.govt_rate_ledger
  for delete to authenticated
  using ((select private.can_write_vendor_govt_rates()));
