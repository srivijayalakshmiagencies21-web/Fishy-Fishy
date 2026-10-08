-- Master data for Fishy-Fishy.
-- Locations are intentionally not included yet.
-- Applied to the Fishy-Fishy project as version 20261005054641.
--
-- Districts are not one flat row of three names:
--   districts          one row per district
--   societies          many societies per district
--   companies          a company exists once
--   district_companies tags a company to one or more districts
--
-- Roles used by row level security come from auth app_metadata.role:
--   admin, manager  can read and change masters
--   employee        can read masters (for later data-entry screens)
-- Do not store the role in user_metadata. That claim is user-editable.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_app_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role'),
    ''
  );
$$;

create or replace function private.can_read_masters()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select private.current_app_role()) in ('admin', 'manager', 'employee');
$$;

create or replace function private.can_write_masters()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (select private.current_app_role()) in ('admin', 'manager');
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.can_read_masters() from public;
revoke all on function private.can_write_masters() from public;

grant execute on function private.current_app_role() to authenticated, service_role;
grant execute on function private.can_read_masters() to authenticated, service_role;
grant execute on function private.can_write_masters() to authenticated, service_role;

create table public.accounts (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint accounts_name_not_blank check (char_length(btrim(name)) > 0)
);

create unique index accounts_name_unique on public.accounts (lower(btrim(name)));

create table public.payment_modes (
  id bigint generated always as identity primary key,
  mode text not null,
  created_at timestamptz not null default now(),
  constraint payment_modes_mode_not_blank check (char_length(btrim(mode)) > 0)
);

create unique index payment_modes_mode_unique on public.payment_modes (lower(btrim(mode)));

create table public.districts (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint districts_name_not_blank check (char_length(btrim(name)) > 0)
);

create unique index districts_name_unique on public.districts (lower(btrim(name)));

create table public.societies (
  id bigint generated always as identity primary key,
  district_id bigint not null references public.districts (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint societies_name_not_blank check (char_length(btrim(name)) > 0)
);

create index societies_district_id_idx on public.societies (district_id);

create unique index societies_name_unique_per_district
  on public.societies (district_id, lower(btrim(name)));

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now(),
  constraint companies_name_not_blank check (char_length(btrim(name)) > 0)
);

create unique index companies_name_unique on public.companies (lower(btrim(name)));

create table public.district_companies (
  district_id bigint not null references public.districts (id) on delete cascade,
  company_id bigint not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (district_id, company_id)
);

create index district_companies_company_id_idx on public.district_companies (company_id);

create table public.vendors (
  id bigint generated always as identity primary key,
  name text not null,
  contact_number text not null,
  vendor_type text not null,
  created_at timestamptz not null default now(),
  constraint vendors_name_not_blank check (char_length(btrim(name)) > 0),
  constraint vendors_contact_number_not_blank check (char_length(btrim(contact_number)) > 0),
  constraint vendors_type_check check (vendor_type in ('Supplier', 'Transporter'))
);

create table public.fishes (
  id bigint generated always as identity primary key,
  fish_type text not null,
  seed_size text not null,
  created_at timestamptz not null default now(),
  constraint fishes_type_not_blank check (char_length(btrim(fish_type)) > 0),
  constraint fishes_seed_size_not_blank check (char_length(btrim(seed_size)) > 0)
);

create unique index fishes_type_size_unique
  on public.fishes (lower(btrim(fish_type)), lower(btrim(seed_size)));

create table public.expenses (
  id bigint generated always as identity primary key,
  towards text not null,
  created_at timestamptz not null default now(),
  constraint expenses_towards_not_blank check (char_length(btrim(towards)) > 0)
);

create unique index expenses_towards_unique on public.expenses (lower(btrim(towards)));

comment on table public.accounts is 'Named accounts used for payments and business books.';
comment on table public.payment_modes is 'How a payment was made.';
comment on table public.districts is 'District master. Societies and companies hang off this row.';
comment on table public.societies is 'Societies that belong to one district.';
comment on table public.companies is 'Company master. Link to districts through district_companies.';
comment on table public.district_companies is 'Tags a company to a district.';
comment on table public.vendors is 'Suppliers and transporters.';
comment on table public.fishes is 'Fish type and seed size pairs.';
comment on table public.expenses is 'Expense heads. The only business field is towards.';

do $$
declare
  master_table text;
begin
  foreach master_table in array array[
    'accounts',
    'payment_modes',
    'districts',
    'societies',
    'companies',
    'district_companies',
    'vendors',
    'fishes',
    'expenses'
  ]
  loop
    execute format('alter table public.%I enable row level security', master_table);
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      master_table
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      master_table
    );
    execute format(
      'grant all on table public.%I to service_role',
      master_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.can_read_masters()))',
      master_table || '_select',
      master_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_write_masters()))',
      master_table || '_insert',
      master_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_write_masters())) with check ((select private.can_write_masters()))',
      master_table || '_update',
      master_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.can_write_masters()))',
      master_table || '_delete',
      master_table
    );
  end loop;
end $$;

insert into public.accounts (name)
values
  ('Pramod''s Personal Account'),
  ('Rahul''s Personal Account'),
  ('SVAG Business Account (Kotak)'),
  ('SVAG Business Account (IndusInd)')
on conflict ((lower(btrim(name)))) do nothing;

insert into public.payment_modes (mode)
values
  ('Cash'),
  ('UPI'),
  ('Online'),
  ('Bank')
on conflict ((lower(btrim(mode)))) do nothing;
