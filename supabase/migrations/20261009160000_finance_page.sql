-- Rename workspace page key transactions -> finance (URL /finance).

alter table public.roles drop constraint roles_pages_known;

update public.roles r
set allowed_pages = mapped.pages
from (
  select
    id,
    coalesce(
      (
        select array_agg(page order by page)
        from (
          select distinct case when p = 'transactions' then 'finance' else p end as page
          from unnest(allowed_pages) as p
        ) deduped
      ),
      '{}'::text[]
    ) as pages
  from public.roles
) mapped
where r.id = mapped.id
  and 'transactions' = any (r.allowed_pages);

update public.roles
set allowed_pages = allowed_pages || array['finance']
where name = 'Admin'
  and is_system
  and not (allowed_pages @> array['finance']);

drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

create policy transactions_select
  on public.transactions for select to authenticated
  using ((select private.has_page('finance')));

create policy transactions_insert
  on public.transactions for insert to authenticated
  with check ((select private.has_page('finance')));

create policy transactions_update
  on public.transactions for update to authenticated
  using ((select private.has_page('finance')))
  with check ((select private.has_page('finance')));

create policy transactions_delete
  on public.transactions for delete to authenticated
  using ((select private.has_page('finance')));

alter table public.roles
  add constraint roles_pages_known
  check (
    allowed_pages <@ array[
      'masters',
      'users',
      'start',
      'transfer',
      'final',
      'overview',
      'finance'
    ]::text[]
  );

create or replace function private.assert_known_pages(pages text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if pages is null or cardinality(pages) = 0 then
    raise exception 'Choose at least one page';
  end if;

  if exists (
    select 1
    from unnest(pages) as page
    where page not in (
      'masters',
      'users',
      'start',
      'transfer',
      'final',
      'overview',
      'finance'
    )
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;
