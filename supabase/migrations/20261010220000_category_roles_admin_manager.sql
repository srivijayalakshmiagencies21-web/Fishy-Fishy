-- Limit every transaction category to Admin and Manager (Finance dropdown).

delete from public.transaction_category_roles;

insert into public.transaction_category_roles (category_id, role_id)
select c.id, r.id
from public.transaction_categories as c
cross join public.roles as r
where r.name in ('Admin', 'Manager');
