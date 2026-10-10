-- Local-only extras after migrations (see supabase/config.toml db.seed).
-- Starter vendors also ship in migration 20261010310000_starter_vendors.sql.

insert into public.vendors (name, contact_number, vendor_type, transporter_scope)
select 'Rama Raju', '9848887959', 'Supplier', null
where not exists (
  select 1 from public.vendors where lower(btrim(name)) = lower('Rama Raju')
);

insert into public.vendors (name, contact_number, vendor_type, transporter_scope)
select 'Rohit', '8885555254', 'Transporter', 'Non-Local'
where not exists (
  select 1 from public.vendors where lower(btrim(name)) = lower('Rohit')
);

update public.vendors
set transporter_scope = 'Non-Local'
where lower(btrim(name)) = lower('Rohit')
  and vendor_type = 'Transporter';
