update public.accounts
set
  opening_balance = 0,
  opening_balance_date = current_date;

alter table public.accounts
  alter column opening_balance_date set default current_date;

alter table public.accounts
  alter column opening_balance_date set not null;
