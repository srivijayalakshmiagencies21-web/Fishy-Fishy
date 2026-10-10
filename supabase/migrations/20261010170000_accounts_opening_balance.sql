alter table public.accounts
  add column if not exists opening_balance numeric(14, 2) not null default 0,
  add column if not exists opening_balance_date date;

alter table public.accounts
  drop constraint if exists accounts_opening_balance_check;

alter table public.accounts
  add constraint accounts_opening_balance_check
  check (opening_balance >= 0);
