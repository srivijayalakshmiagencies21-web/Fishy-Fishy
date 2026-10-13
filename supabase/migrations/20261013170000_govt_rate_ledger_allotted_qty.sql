alter table public.govt_rate_ledger
  add column if not exists govt_allotted_qty numeric;

alter table public.govt_rate_ledger
  drop constraint if exists govt_rate_ledger_allotted_qty_nonneg;

alter table public.govt_rate_ledger
  add constraint govt_rate_ledger_allotted_qty_nonneg
  check (govt_allotted_qty is null or govt_allotted_qty >= 0);

comment on column public.govt_rate_ledger.govt_allotted_qty is 'Govt allotted quantity for this FY and district.';
