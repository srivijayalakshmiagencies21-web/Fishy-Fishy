-- Rename cost nature "Non-Cost / Balance Sheet" to "Non-Cost".

update public.transaction_categories
set cost_nature = 'Non-Cost'
where cost_nature = 'Non-Cost / Balance Sheet';

alter table public.transaction_categories
  drop constraint if exists transaction_categories_cost_nature_check;

alter table public.transaction_categories
  add constraint transaction_categories_cost_nature_check
  check (
    cost_nature in (
      'Direct',
      'Overhead',
      'Revenue',
      'Non-Cost'
    )
  );
