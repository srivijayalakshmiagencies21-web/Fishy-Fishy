drop function if exists public.list_app_users();

create function public.list_app_users()
returns table (
  user_id uuid,
  email text,
  role_id uuid,
  role_name text,
  created_at timestamptz,
  active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor text;
begin
  actor := private.role_name();

  if actor is distinct from 'Admin'
     and actor is distinct from 'Manager'
     and not private.has_page('users') then
    raise exception 'Not allowed';
  end if;

  return query
  select
    account.id,
    account.email::text,
    assignment.role_id,
    role.name,
    account.created_at,
    account.banned_until is null or account.banned_until <= now()
  from auth.users as account
  left join public.user_roles as assignment on assignment.user_id = account.id
  left join public.roles as role on role.id = assignment.role_id
  where account.deleted_at is null
    and (
      actor = 'Admin'
      or private.has_page('users')
      or role.name in ('Manager', 'Employee')
    )
  order by account.created_at;
end;
$$;

revoke all on function public.list_app_users() from public;
grant execute on function public.list_app_users() to authenticated;
