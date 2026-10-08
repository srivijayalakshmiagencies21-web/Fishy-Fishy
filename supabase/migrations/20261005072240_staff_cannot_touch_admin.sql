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

  if actor = 'Employee'
     or (
       actor is distinct from 'Admin'
       and actor is distinct from 'Manager'
       and not private.has_page('users')
     ) then
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

create or replace function public.assign_user_role(p_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_pages text[];
  next_name text;
begin
  perform private.assert_users_page();

  select allowed_pages, name into next_pages, next_name
  from public.roles
  where id = p_role_id;

  if next_pages is null then
    raise exception 'Role not found';
  end if;

  if next_name = 'Admin' and private.role_name() is distinct from 'Admin' then
    raise exception 'Not allowed';
  end if;

  if p_user_id = (select auth.uid()) and not ('users' = any (next_pages)) then
    raise exception 'You cannot remove your own user management access';
  end if;

  insert into public.user_roles (user_id, role_id)
  values (p_user_id, p_role_id)
  on conflict (user_id) do update set role_id = excluded.role_id;
end;
$$;
