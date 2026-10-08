-- Page access for the workspace.
-- Admin opens Masters and User management.
-- Manager opens Masters.
-- Employee has no pages until data-entry screens exist.
-- The role lives in public.user_roles, not in a JWT claim.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  allowed_pages text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint roles_name_not_blank check (char_length(btrim(name)) > 0),
  constraint roles_pages_known check (allowed_pages <@ array['masters', 'users']::text[])
);

create unique index roles_name_unique on public.roles (lower(btrim(name)));

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  created_at timestamptz not null default now()
);

create index user_roles_role_id_idx on public.user_roles (role_id);

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

revoke all on table public.roles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.roles to authenticated;

create or replace function private.has_page(target text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as assignment
    join public.roles as role on role.id = assignment.role_id
    where assignment.user_id = (select auth.uid())
      and target = any (role.allowed_pages)
  );
$$;

create or replace function private.allowed_pages()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select role.allowed_pages
      from public.user_roles as assignment
      join public.roles as role on role.id = assignment.role_id
      where assignment.user_id = (select auth.uid())
    ),
    '{}'::text[]
  );
$$;

create or replace function private.role_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select role.name
      from public.user_roles as assignment
      join public.roles as role on role.id = assignment.role_id
      where assignment.user_id = (select auth.uid())
    ),
    ''
  );
$$;

create or replace function private.can_read_masters()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_page('masters');
$$;

create or replace function private.can_write_masters()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_page('masters');
$$;

do $$
declare
  master_table text;
begin
  foreach master_table in array array[
    'accounts',
    'payment_modes',
    'districts',
    'societies',
    'companies',
    'district_companies',
    'vendors',
    'fishes',
    'expenses'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', master_table || '_select', master_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.can_read_masters()))',
      master_table || '_select',
      master_table
    );
  end loop;
end $$;

create policy roles_select
  on public.roles
  for select
  to authenticated
  using ((select private.has_page('users')));

create or replace function private.assert_users_page()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_page('users') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

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
    where page not in ('masters', 'users')
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;

create or replace function public.get_my_pages()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select private.allowed_pages();
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.role_name();
$$;

create or replace function public.list_app_users()
returns table (
  user_id uuid,
  email text,
  role_id uuid,
  role_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_users_page();

  return query
  select
    account.id,
    account.email::text,
    assignment.role_id,
    role.name,
    account.created_at
  from auth.users as account
  left join public.user_roles as assignment on assignment.user_id = account.id
  left join public.roles as role on role.id = assignment.role_id
  order by account.created_at;
end;
$$;

create or replace function public.create_role(p_name text, p_allowed_pages text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform private.assert_users_page();
  perform private.assert_known_pages(p_allowed_pages);

  insert into public.roles (name, allowed_pages)
  values (btrim(p_name), p_allowed_pages)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.update_role(p_role_id uuid, p_name text, p_allowed_pages text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_role boolean;
begin
  perform private.assert_users_page();
  perform private.assert_known_pages(p_allowed_pages);

  select is_system into system_role from public.roles where id = p_role_id;
  if system_role is null then
    raise exception 'Role not found';
  end if;
  if system_role then
    raise exception 'System roles cannot be changed';
  end if;

  update public.roles
  set name = btrim(p_name),
      allowed_pages = p_allowed_pages
  where id = p_role_id;
end;
$$;

create or replace function public.delete_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_role boolean;
begin
  perform private.assert_users_page();

  select is_system into system_role from public.roles where id = p_role_id;
  if system_role is null then
    raise exception 'Role not found';
  end if;
  if system_role then
    raise exception 'System roles cannot be deleted';
  end if;
  if exists (select 1 from public.user_roles where role_id = p_role_id) then
    raise exception 'This role is still assigned to an account';
  end if;

  delete from public.roles where id = p_role_id;
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
begin
  perform private.assert_users_page();

  select allowed_pages into next_pages from public.roles where id = p_role_id;
  if next_pages is null then
    raise exception 'Role not found';
  end if;

  if p_user_id = (select auth.uid()) and not ('users' = any (next_pages)) then
    raise exception 'You cannot remove your own user management access';
  end if;

  insert into public.user_roles (user_id, role_id)
  values (p_user_id, p_role_id)
  on conflict (user_id) do update set role_id = excluded.role_id;
end;
$$;

revoke all on function private.has_page(text) from public;
revoke all on function private.allowed_pages() from public;
revoke all on function private.role_name() from public;
revoke all on function private.assert_users_page() from public;
revoke all on function private.assert_known_pages(text[]) from public;
revoke all on function public.get_my_pages() from public;
revoke all on function public.get_my_role() from public;
revoke all on function public.list_app_users() from public;
revoke all on function public.create_role(text, text[]) from public;
revoke all on function public.update_role(uuid, text, text[]) from public;
revoke all on function public.delete_role(uuid) from public;
revoke all on function public.assign_user_role(uuid, uuid) from public;

grant execute on function private.has_page(text) to authenticated;
grant execute on function private.allowed_pages() to authenticated;
grant execute on function private.role_name() to authenticated;
grant execute on function private.assert_users_page() to authenticated;
grant execute on function private.assert_known_pages(text[]) to authenticated;
grant execute on function public.get_my_pages() to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.list_app_users() to authenticated;
grant execute on function public.create_role(text, text[]) to authenticated;
grant execute on function public.update_role(uuid, text, text[]) to authenticated;
grant execute on function public.delete_role(uuid) to authenticated;
grant execute on function public.assign_user_role(uuid, uuid) to authenticated;

insert into public.roles (name, allowed_pages, is_system)
values
  ('Admin', array['masters', 'users'], true),
  ('Manager', array['masters'], false),
  ('Employee', array[]::text[], false);

insert into public.user_roles (user_id, role_id)
select account.id, role.id
from auth.users as account
join public.roles as role on role.name = 'Admin'
where account.email = 'admin@fishy-fishy.com'
on conflict (user_id) do update set role_id = excluded.role_id;
