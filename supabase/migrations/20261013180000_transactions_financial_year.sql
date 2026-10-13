-- Income (and other) transactions can be tagged to a financial year.

alter table public.transactions
  add column if not exists financial_year_id bigint references public.financial_years (id) on delete set null;

create index if not exists transactions_financial_year_id_idx
  on public.transactions (financial_year_id);

comment on column public.transactions.financial_year_id is 'Required for income with district allocation; optional otherwise.';
