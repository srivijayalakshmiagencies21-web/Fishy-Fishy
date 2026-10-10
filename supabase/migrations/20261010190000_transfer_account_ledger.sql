-- Transfers: ledger account is the destination only (account_id); no to_account_id row.

alter table public.transactions
  drop constraint if exists transactions_transfer_to_account;

alter table public.transactions
  drop constraint if exists transactions_non_transfer_no_to_account;

update public.transactions
set
  account_id = to_account_id,
  to_account_id = null
where type = 'transfer'
  and to_account_id is not null;

alter table public.transactions
  add constraint transactions_transfer_no_to_account check (
    type <> 'transfer' or to_account_id is null
  );

alter table public.transactions
  add constraint transactions_non_transfer_no_to_account check (
    type = 'transfer' or to_account_id is null
  );
