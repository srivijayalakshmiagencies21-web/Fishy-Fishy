-- Govt rate and qty are per FY + district; companies are tags on that row.

create table public.govt_rate_ledger_district (
  id bigint generated always as identity primary key,
  financial_year_id bigint not null references public.financial_years (id) on delete restrict,
  district_id bigint not null references public.districts (id) on delete restrict,
  rate numeric,
  govt_recorded_qty numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint govt_rate_ledger_district_unique unique (financial_year_id, district_id),
  constraint govt_rate_ledger_district_rate_nonneg check (rate is null or rate >= 0),
  constraint govt_rate_ledger_district_qty_nonneg check (govt_recorded_qty is null or govt_recorded_qty >= 0)
);

create table public.govt_rate_ledger_district_companies (
  ledger_id bigint not null references public.govt_rate_ledger_district (id) on delete cascade,
  company_id bigint not null references public.companies (id) on delete restrict,
  primary key (ledger_id, company_id)
);

create index govt_rate_ledger_district_financial_year_id_idx
  on public.govt_rate_ledger_district (financial_year_id);

comment on table public.govt_rate_ledger_district is 'Govt rates ledger row per FY and district.';
comment on table public.govt_rate_ledger_district_companies is 'Companies tagged on a district govt ledger row.';

-- Migrate from per-company ledger (if present).
insert into public.govt_rate_ledger_district (
  financial_year_id,
  district_id,
  rate,
  govt_recorded_qty,
  created_at,
  updated_at
)
select distinct on (financial_year_id, district_id)
  financial_year_id,
  district_id,
  rate,
  govt_recorded_qty,
  created_at,
  updated_at
from public.govt_rate_ledger
order by financial_year_id, district_id, id;

insert into public.govt_rate_ledger_district_companies (ledger_id, company_id)
select d.id, o.company_id
from public.govt_rate_ledger o
join public.govt_rate_ledger_district d
  on d.financial_year_id = o.financial_year_id
 and d.district_id = o.district_id;

drop table public.govt_rate_ledger;

alter table public.govt_rate_ledger_district rename to govt_rate_ledger;

alter table public.govt_rate_ledger_district_companies rename to govt_rate_ledger_companies;

alter table public.govt_rate_ledger_companies
  rename constraint govt_rate_ledger_district_companies_pkey to govt_rate_ledger_companies_pkey;

alter table public.govt_rate_ledger
  rename constraint govt_rate_ledger_district_unique to govt_rate_ledger_unique;

alter table public.govt_rate_ledger
  rename constraint govt_rate_ledger_district_rate_nonneg to govt_rate_ledger_rate_nonneg;

alter table public.govt_rate_ledger
  rename constraint govt_rate_ledger_district_qty_nonneg to govt_rate_ledger_qty_nonneg;

alter index govt_rate_ledger_district_financial_year_id_idx rename to govt_rate_ledger_financial_year_id_idx;

comment on table public.govt_rate_ledger is 'Govt rates per FY and district (companies in govt_rate_ledger_companies).';

alter table public.govt_rate_ledger enable row level security;
alter table public.govt_rate_ledger_companies enable row level security;

grant select, insert, update, delete on table public.govt_rate_ledger to authenticated;
grant select, insert, update, delete on table public.govt_rate_ledger_companies to authenticated;
grant all on table public.govt_rate_ledger to service_role;
grant all on table public.govt_rate_ledger_companies to service_role;

drop policy if exists govt_rate_ledger_select on public.govt_rate_ledger;
drop policy if exists govt_rate_ledger_insert on public.govt_rate_ledger;
drop policy if exists govt_rate_ledger_update on public.govt_rate_ledger;
drop policy if exists govt_rate_ledger_delete on public.govt_rate_ledger;

create policy govt_rate_ledger_select on public.govt_rate_ledger
  for select to authenticated using (true);

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

create policy govt_rate_ledger_companies_select on public.govt_rate_ledger_companies
  for select to authenticated using (true);

create policy govt_rate_ledger_companies_insert on public.govt_rate_ledger_companies
  for insert to authenticated
  with check ((select private.can_write_vendor_govt_rates()));

create policy govt_rate_ledger_companies_update on public.govt_rate_ledger_companies
  for update to authenticated
  using ((select private.can_write_vendor_govt_rates()))
  with check ((select private.can_write_vendor_govt_rates()));

create policy govt_rate_ledger_companies_delete on public.govt_rate_ledger_companies
  for delete to authenticated
  using ((select private.can_write_vendor_govt_rates()));
