-- Cashbook entries and Transactions workspace page.

create table public.transactions (
  id bigint generated always as identity primary key,
  txn_date date not null default (timezone('Asia/Kolkata', now()))::date,
  type text not null check (type in ('in', 'out', 'transfer')),
  account_id bigint not null references public.accounts (id) on delete restrict,
  to_account_id bigint references public.accounts (id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null default '',
  payment_mode text not null default '',
  party text not null default '',
  remarks text not null default '',
  journey_id uuid references public.journeys (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint transactions_transfer_to_account check (
    type <> 'transfer' or (to_account_id is not null and to_account_id <> account_id)
  ),
  constraint transactions_non_transfer_no_to_account check (
    type = 'transfer' or to_account_id is null
  )
);

create index transactions_txn_date_idx on public.transactions (txn_date desc, id desc);
create index transactions_account_id_idx on public.transactions (account_id);

alter table public.transactions enable row level security;

create policy transactions_select
  on public.transactions for select to authenticated
  using ((select private.has_page('transactions')));

create policy transactions_insert
  on public.transactions for insert to authenticated
  with check ((select private.has_page('transactions')));

create policy transactions_update
  on public.transactions for update to authenticated
  using ((select private.has_page('transactions')))
  with check ((select private.has_page('transactions')));

create policy transactions_delete
  on public.transactions for delete to authenticated
  using ((select private.has_page('transactions')));

alter table public.roles drop constraint roles_pages_known;

alter table public.roles
  add constraint roles_pages_known
  check (
    allowed_pages <@ array[
      'masters',
      'users',
      'start',
      'transfer',
      'final',
      'overview',
      'transactions'
    ]::text[]
  );

create or replace function private.assert_known_pages(pages text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if pages is null or cardinality(pages) = 0 then
    raise exception 'Choose at least one page';
  end if;

  if exists (
    select 1
    from unnest(pages) as page
    where page not in (
      'masters',
      'users',
      'start',
      'transfer',
      'final',
      'overview',
      'transactions'
    )
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;

update public.roles
set allowed_pages = allowed_pages || array['transactions']
where name = 'Admin'
  and is_system
  and not (allowed_pages @> array['transactions']);
