-- Allow Vendor & Govt Rates users to add financial years.

grant insert on table public.financial_years to authenticated;

create policy financial_years_insert on public.financial_years
  for insert to authenticated
  with check ((select private.can_write_vendor_govt_rates()));
