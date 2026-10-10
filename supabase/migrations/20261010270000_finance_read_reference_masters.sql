-- Finance users need reference masters (payment modes, accounts, vendors, …) without the Masters page.
-- RBAC re-bound master SELECT to can_read_masters() (Masters page only).

create or replace function private.can_read_master_reference()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_page('masters') or private.has_page('finance');
$$;

revoke all on function private.can_read_master_reference() from public;
grant execute on function private.can_read_master_reference() to authenticated, service_role;

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
    'fishes'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', master_table || '_select', master_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.can_read_master_reference()))',
      master_table || '_select',
      master_table
    );
  end loop;
end $$;
