-- Split Finance into Manager Finance and Executive Finance pages; drop per-role KPI layout.

create or replace function private.has_finance_page()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_page('finance-manager') or private.has_page('finance-executive');
$$;

revoke all on function private.has_finance_page() from public;
grant execute on function private.has_finance_page() to authenticated, service_role;

create or replace function private.can_read_master_reference()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_page('masters') or private.has_finance_page();
$$;

drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

create policy transactions_select
  on public.transactions for select to authenticated
  using ((select private.has_finance_page()));

create policy transactions_insert
  on public.transactions for insert to authenticated
  with check ((select private.has_finance_page()));

create policy transactions_update
  on public.transactions for update to authenticated
  using ((select private.has_finance_page()))
  with check ((select private.has_finance_page()));

create policy transactions_delete
  on public.transactions for delete to authenticated
  using ((select private.has_finance_page()));

alter table public.roles drop constraint if exists roles_pages_known;

-- Admin: both finance pages (replace legacy `finance` key).
update public.roles
set allowed_pages = (
  select coalesce(array_agg(distinct p order by p), '{}'::text[])
  from (
    select unnest(array_remove(allowed_pages, 'finance')) as p
    union all
    select 'finance-manager'::text
    union all
    select 'finance-executive'::text
  ) as merged
)
where lower(btrim(name)) = 'admin'
  and 'finance' = any (allowed_pages);

-- Executive KPI roles -> Executive Finance only.
update public.roles
set allowed_pages = array_append(array_remove(allowed_pages, 'finance'), 'finance-executive')
where 'finance' = any (allowed_pages)
  and finance_kpi_layout = 'executive'
  and lower(btrim(name)) <> 'admin';

-- Remaining legacy finance -> Manager Finance.
update public.roles
set allowed_pages = array_append(array_remove(allowed_pages, 'finance'), 'finance-manager')
where 'finance' = any (allowed_pages);

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
      'finance-manager',
      'finance-executive'
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
      'finance-manager',
      'finance-executive'
    )
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;

drop function if exists public.get_my_finance_kpi_layout();

drop function if exists public.create_role(text, text[], text);
drop function if exists public.update_role(uuid, text, text[], text);

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

revoke all on function public.create_role(text, text[]) from public;
revoke all on function public.update_role(uuid, text, text[]) from public;
grant execute on function public.create_role(text, text[]) to authenticated;
grant execute on function public.update_role(uuid, text, text[]) to authenticated;

alter table public.roles drop column if exists finance_kpi_layout;

drop function if exists private.assert_finance_kpi_layout(text);
