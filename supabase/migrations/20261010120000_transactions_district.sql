alter table public.transactions
  add column if not exists district_id bigint references public.districts (id) on delete restrict;

create index if not exists transactions_district_id_idx on public.transactions (district_id);
