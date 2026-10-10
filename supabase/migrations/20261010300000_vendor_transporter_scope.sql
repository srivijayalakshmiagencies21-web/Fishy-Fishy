-- Transporters: Local vs Non-Local (suppliers leave this null).

alter table public.vendors
  add column if not exists transporter_scope text;

update public.vendors
set transporter_scope = 'Local'
where vendor_type = 'Transporter'
  and transporter_scope is null;

update public.vendors
set transporter_scope = 'Non-Local'
where vendor_type = 'Transporter'
  and lower(btrim(name)) = lower('Rohit');

alter table public.vendors
  drop constraint if exists vendors_transporter_scope_check;

alter table public.vendors
  add constraint vendors_transporter_scope_check
  check (
    transporter_scope is null
    or transporter_scope in ('Local', 'Non-Local')
  );

alter table public.vendors
  drop constraint if exists vendors_transporter_scope_pairing;

alter table public.vendors
  add constraint vendors_transporter_scope_pairing
  check (
    (vendor_type = 'Supplier' and transporter_scope is null)
    or (vendor_type = 'Transporter' and transporter_scope is not null)
  );

comment on column public.vendors.transporter_scope is 'Local or Non-Local; required when vendor_type is Transporter.';
