-- Repair list_account_link_users if an earlier deploy used has_page() only.
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
