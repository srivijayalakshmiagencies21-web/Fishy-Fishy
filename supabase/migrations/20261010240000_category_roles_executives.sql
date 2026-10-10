-- Finance executives: allow Money In / Money Out categories (not transfer-only heads).

insert into public.transaction_category_roles (category_id, role_id)
select c.id, r.id
from public.transaction_categories as c
cross join public.roles as r
where lower(btrim(r.name)) in (
  'start point executive',
  'transfer and final point executive'
)
and c.transaction_type in ('in', 'out')
on conflict do nothing;
