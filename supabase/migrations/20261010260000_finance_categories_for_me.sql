-- Finance users must read allowed categories even without Masters page access.

drop policy if exists expenses_select on public.transaction_categories;
drop policy if exists transaction_categories_select on public.transaction_categories;

create policy transaction_categories_select
  on public.transaction_categories for select to authenticated
  using (true);

create or replace function public.finance_categories_for_me()
returns table (
  id bigint,
  name text,
  transaction_type text,
  cost_nature text,
  default_allocation text,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.transaction_type,
    c.cost_nature,
    c.default_allocation,
    c.active
  from public.transaction_categories as c
  where c.active
    and (
      coalesce((select private.role_name()), '') = 'Admin'
      or not exists (
        select 1
        from public.transaction_category_roles as link
        where link.category_id = c.id
      )
      or exists (
        select 1
        from public.transaction_category_roles as link
        inner join public.user_roles as assignment
          on assignment.role_id = link.role_id
          and assignment.user_id = auth.uid()
        where link.category_id = c.id
      )
    )
  order by c.name;
$$;

revoke all on function public.finance_categories_for_me() from public;
grant execute on function public.finance_categories_for_me() to authenticated;
