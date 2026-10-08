-- Signed-in staff can read every master. Adding and removing rows stays with admin and manager.
-- The earlier select policy depended on app_metadata.role inside the access token, so a token
-- issued before that role was set returned no rows.

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
      'create policy %I on public.%I for select to authenticated using (true)',
      master_table || '_select',
      master_table
    );
  end loop;
end $$;
