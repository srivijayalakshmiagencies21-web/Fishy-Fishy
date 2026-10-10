-- Starter vendors for finance party suggestions and journey flows (idempotent).

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
set
  contact_number = '8885555254',
  vendor_type = 'Transporter',
  transporter_scope = 'Non-Local'
where lower(btrim(name)) = lower('Rohit');

update public.vendors
set
  contact_number = '9848887959',
  vendor_type = 'Supplier',
  transporter_scope = null
where lower(btrim(name)) = lower('Rama Raju');
