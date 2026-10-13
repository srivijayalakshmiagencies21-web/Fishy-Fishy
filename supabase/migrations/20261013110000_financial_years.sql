-- Financial years (Apr–Mar) and which districts are active per year.

create table public.financial_years (
  id bigint generated always as identity primary key,
  label text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint financial_years_label_not_blank check (char_length(btrim(label)) > 0),
  constraint financial_years_range check (end_date > start_date)
);

create unique index financial_years_label_unique on public.financial_years (lower(btrim(label)));

create table public.financial_year_districts (
  financial_year_id bigint not null references public.financial_years (id) on delete cascade,
  district_id bigint not null references public.districts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (financial_year_id, district_id)
);

create index financial_year_districts_district_id_idx on public.financial_year_districts (district_id);

comment on table public.financial_years is 'Indian financial year (Apr–Mar). Added via Vendor & Govt Rates.';
comment on table public.financial_year_districts is 'Districts tagged for a given financial year.';

alter table public.financial_years enable row level security;
alter table public.financial_year_districts enable row level security;

revoke all on table public.financial_years from anon, authenticated;
revoke all on table public.financial_year_districts from anon, authenticated;

grant select on table public.financial_years to authenticated;
grant select, insert, update, delete on table public.financial_year_districts to authenticated;
grant all on table public.financial_years to service_role;
grant all on table public.financial_year_districts to service_role;

create policy financial_years_select on public.financial_years
  for select to authenticated
  using (true);

create policy financial_year_districts_select on public.financial_year_districts
  for select to authenticated
  using (true);

create policy financial_year_districts_insert on public.financial_year_districts
  for insert to authenticated
  with check ((select private.can_write_masters()));

create policy financial_year_districts_update on public.financial_year_districts
  for update to authenticated
  using ((select private.can_write_masters()))
  with check ((select private.can_write_masters()));

create policy financial_year_districts_delete on public.financial_year_districts
  for delete to authenticated
  using ((select private.can_write_masters()));
