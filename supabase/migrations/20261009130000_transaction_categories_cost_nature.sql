-- Drop Statutory and Other from cost nature options.

update public.transaction_categories
set cost_nature = 'Direct'
where cost_nature in ('Statutory', 'Other');

alter table public.transaction_categories
  drop constraint if exists transaction_categories_cost_nature_check;

alter table public.transaction_categories
  add constraint transaction_categories_cost_nature_check
  check (
    cost_nature in (
      'Direct',
      'Overhead',
      'Revenue',
      'Non-Cost / Balance Sheet'
    )
  );
