-- Align expense master with BYOT-CRM transaction_categories (name + classification fields).

alter table public.expenses rename to transaction_categories;

alter table public.transaction_categories rename column towards to name;

alter table public.transaction_categories
  add column if not exists transaction_type text not null default 'out',
  add column if not exists cost_nature text not null default 'Direct',
  add column if not exists default_allocation text not null default 'company',
  add column if not exists active boolean not null default true;

alter table public.transaction_categories drop constraint if exists expenses_towards_not_blank;

alter table public.transaction_categories
  add constraint transaction_categories_name_not_blank check (char_length(btrim(name)) > 0);

drop index if exists public.expenses_towards_unique;

create unique index if not exists transaction_categories_name_unique
  on public.transaction_categories (lower(btrim(name)));

alter table public.transaction_categories
  drop constraint if exists transaction_categories_transaction_type_check;

alter table public.transaction_categories
  add constraint transaction_categories_transaction_type_check
  check (transaction_type in ('in', 'out', 'both'));

alter table public.transaction_categories
  drop constraint if exists transaction_categories_cost_nature_check;

alter table public.transaction_categories
  add constraint transaction_categories_cost_nature_check
  check (
    cost_nature in (
      'Direct',
      'Overhead',
      'Revenue',
      'Statutory',
      'Other',
      'Non-Cost / Balance Sheet'
    )
  );

alter table public.transaction_categories
  drop constraint if exists transaction_categories_default_allocation_check;

alter table public.transaction_categories
  add constraint transaction_categories_default_allocation_check
  check (default_allocation in ('company', 'ask', 'project'));

comment on table public.transaction_categories is 'Categories used to classify transactions.';
