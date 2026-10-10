-- Link transaction categories to roles; finance users only see categories for their role.

create table public.transaction_category_roles (
  category_id bigint not null references public.transaction_categories (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (category_id, role_id)
);

create index transaction_category_roles_role_id_idx
  on public.transaction_category_roles (role_id);

comment on table public.transaction_category_roles is
  'When empty for a category, all roles may use it; otherwise only listed roles see it in Finance.';

alter table public.transaction_category_roles enable row level security;
revoke all on table public.transaction_category_roles from anon, authenticated;
grant select, insert, update, delete on table public.transaction_category_roles to authenticated;
grant all on table public.transaction_category_roles to service_role;

create policy transaction_category_roles_select
  on public.transaction_category_roles for select to authenticated
  using (true);

create policy transaction_category_roles_insert
  on public.transaction_category_roles for insert to authenticated
  with check ((select private.can_write_masters()));

create policy transaction_category_roles_update
  on public.transaction_category_roles for update to authenticated
  using ((select private.can_write_masters()))
  with check ((select private.can_write_masters()));

create policy transaction_category_roles_delete
  on public.transaction_category_roles for delete to authenticated
  using ((select private.can_write_masters()));

create or replace function public.get_my_role_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select assignment.role_id
  from public.user_roles as assignment
  where assignment.user_id = auth.uid()
$$;

revoke all on function public.get_my_role_id() from public;
grant execute on function public.get_my_role_id() to authenticated;
