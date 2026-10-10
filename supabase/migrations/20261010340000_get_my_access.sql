-- One round trip for session bootstrap (role + pages).
create or replace function public.get_my_access()
returns table (role text, pages text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(
      (
        select r.name
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
      ),
      ''
    ) as role,
    coalesce(
      (
        select r.allowed_pages
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
      ),
      '{}'::text[]
    ) as pages;
$$;

revoke all on function public.get_my_access() from public;
grant execute on function public.get_my_access() to authenticated;
