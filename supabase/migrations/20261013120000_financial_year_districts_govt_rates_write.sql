-- District tagging for a financial year is edited on Vendor & Govt Rates (Govt tab).

create or replace function private.can_write_vendor_govt_rates()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_page('vendor-govt-rates');
$$;

revoke all on function private.can_write_vendor_govt_rates() from public;
grant execute on function private.can_write_vendor_govt_rates() to authenticated, service_role;

drop policy if exists financial_year_districts_insert on public.financial_year_districts;
drop policy if exists financial_year_districts_update on public.financial_year_districts;
drop policy if exists financial_year_districts_delete on public.financial_year_districts;

create policy financial_year_districts_insert on public.financial_year_districts
  for insert to authenticated
  with check ((select private.can_write_vendor_govt_rates()));

create policy financial_year_districts_update on public.financial_year_districts
  for update to authenticated
  using ((select private.can_write_vendor_govt_rates()))
  with check ((select private.can_write_vendor_govt_rates()));

create policy financial_year_districts_delete on public.financial_year_districts
  for delete to authenticated
  using ((select private.can_write_vendor_govt_rates()));
