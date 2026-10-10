alter table public.accounts
  add column if not exists account_type text not null default 'account',
  add column if not exists linked_user_id uuid references auth.users (id) on delete set null;

alter table public.accounts
  drop constraint if exists accounts_account_type_check;

alter table public.accounts
  add constraint accounts_account_type_check
  check (account_type in ('account', 'wallet'));

-- Usernames for the account "Linked to" picker. Masters users may not have the Users page,
-- so this is separate from list_app_users.
create or replace function public.list_account_link_users()
returns table (
  user_id uuid,
  username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.can_read_masters()) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    account.id,
    split_part(account.email::text, '@', 1)
  from auth.users as account
  where account.deleted_at is null
    and account.email is not null
    and char_length(btrim(split_part(account.email::text, '@', 1))) > 0
  order by split_part(account.email::text, '@', 1);
end;
$$;

revoke all on function public.list_account_link_users() from public;
grant execute on function public.list_account_link_users() to authenticated;
