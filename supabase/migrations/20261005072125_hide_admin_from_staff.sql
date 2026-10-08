create or replace function public.list_app_users()
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

  if actor is distinct from 'Admin' and actor is distinct from 'Manager' then
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
      or role.name in ('Manager', 'Employee')
    )
  order by account.created_at;
end;
$$;

drop policy if exists roles_select on public.roles;

create policy roles_select
  on public.roles
  for select
  to authenticated
  using (
    (select private.role_name()) = 'Admin'
    or (
      (select private.has_page('users'))
      and name <> 'Admin'
    )
  );
