update public.transaction_categories
set default_allocation = 'company'
where default_allocation = 'ask';

alter table public.transaction_categories
  drop constraint if exists transaction_categories_default_allocation_check;

alter table public.transaction_categories
  add constraint transaction_categories_default_allocation_check
  check (default_allocation in ('company', 'project'));
