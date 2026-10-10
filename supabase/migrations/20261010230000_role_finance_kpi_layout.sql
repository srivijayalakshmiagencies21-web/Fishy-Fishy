-- Finance KPI card layout per role (configured in Users & Roles).

alter table public.roles
  add column if not exists finance_kpi_layout text not null default 'none';

alter table public.roles
  drop constraint if exists roles_finance_kpi_layout_check;

alter table public.roles
  add constraint roles_finance_kpi_layout_check
  check (finance_kpi_layout in ('none', 'cost-nature', 'executive'));

update public.roles
set finance_kpi_layout = 'cost-nature'
where lower(btrim(name)) in ('admin', 'manager');

update public.roles
set finance_kpi_layout = 'executive'
where lower(btrim(name)) in (
  'start point executive',
  'transfer and final point executive'
);

create or replace function private.assert_finance_kpi_layout(p_layout text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_layout is null or p_layout not in ('none', 'cost-nature', 'executive') then
    raise exception 'Choose a valid Finance KPI layout';
  end if;
end;
$$;

create or replace function public.get_my_finance_kpi_layout()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(role.finance_kpi_layout, 'none')
  from public.user_roles as assignment
  join public.roles as role on role.id = assignment.role_id
  where assignment.user_id = auth.uid()
$$;

revoke all on function public.get_my_finance_kpi_layout() from public;
grant execute on function public.get_my_finance_kpi_layout() to authenticated;

create or replace function public.create_role(
  p_name text,
  p_allowed_pages text[],
  p_finance_kpi_layout text default 'none'
)
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
  perform private.assert_finance_kpi_layout(p_finance_kpi_layout);

  insert into public.roles (name, allowed_pages, finance_kpi_layout)
  values (btrim(p_name), p_allowed_pages, p_finance_kpi_layout)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.update_role(
  p_role_id uuid,
  p_name text,
  p_allowed_pages text[],
  p_finance_kpi_layout text default 'none'
)
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
  perform private.assert_finance_kpi_layout(p_finance_kpi_layout);

  select is_system into system_role from public.roles where id = p_role_id;
  if system_role is null then
    raise exception 'Role not found';
  end if;
  if system_role then
    raise exception 'System roles cannot be changed';
  end if;

  update public.roles
  set name = btrim(p_name),
      allowed_pages = p_allowed_pages,
      finance_kpi_layout = p_finance_kpi_layout
  where id = p_role_id;
end;
$$;

grant execute on function public.create_role(text, text[], text) to authenticated;
grant execute on function public.update_role(uuid, text, text[], text) to authenticated;
