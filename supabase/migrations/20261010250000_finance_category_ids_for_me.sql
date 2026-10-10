-- Which transaction categories the signed-in user may use in Finance (role links + Admin).

create or replace function public.finance_category_ids_for_me()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.transaction_categories as c
  where c.active
    and (
      (select private.role_name()) = 'Admin'
      or not exists (
        select 1
        from public.transaction_category_roles as link
        where link.category_id = c.id
      )
      or exists (
        select 1
        from public.transaction_category_roles as link
        join public.user_roles as assignment on assignment.role_id = link.role_id
        where link.category_id = c.id
          and assignment.user_id = auth.uid()
      )
    );
$$;

revoke all on function public.finance_category_ids_for_me() from public;
grant execute on function public.finance_category_ids_for_me() to authenticated;
