-- Snapshot society name on unload drops so masters can remove societies without losing closed journey history.

alter table public.truck_unload_drops
  add column if not exists society_name text;

update public.truck_unload_drops as d
set society_name = s.name
from public.societies as s
where s.id = d.society_id
  and (d.society_name is null or btrim(d.society_name) = '');

alter table public.truck_unload_drops
  drop constraint if exists truck_unload_drops_society_id_fkey;

alter table public.truck_unload_drops
  alter column society_id drop not null;

alter table public.truck_unload_drops
  add constraint truck_unload_drops_society_id_fkey
  foreign key (society_id) references public.societies (id) on delete set null;

alter table public.truck_unload_drops
  drop constraint if exists truck_unload_drops_society_present;

alter table public.truck_unload_drops
  add constraint truck_unload_drops_society_present check (
    society_id is not null
    or (society_name is not null and char_length(btrim(society_name)) > 0)
  );

comment on column public.truck_unload_drops.society_name is
  'Society label at unload time; kept when society_id is cleared from masters.';
