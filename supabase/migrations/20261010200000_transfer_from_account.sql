-- Transfer: account_id = destination (ledger); to_account_id = source when recorded.

alter table public.transactions
  drop constraint if exists transactions_transfer_no_to_account;

alter table public.transactions
  add constraint transactions_transfer_accounts check (
    type <> 'transfer'
    or (
      account_id is not null
      and (
        to_account_id is null
        or to_account_id <> account_id
      )
    )
  );
