-- Rename workspace page key overview -> timeline (URL /timeline).

alter table public.roles drop constraint if exists roles_pages_known;

update public.roles
set allowed_pages = (
  select coalesce(array_agg(distinct page order by page), '{}'::text[])
  from (
    select case when p = 'overview' then 'timeline' else p end as page
    from unnest(allowed_pages) as p
  ) as mapped
)
where 'overview' = any (allowed_pages);

alter table public.roles
  add constraint roles_pages_known
  check (
    allowed_pages <@ array[
      'masters',
      'users',
      'start',
      'transfer',
      'final',
      'timeline',
      'finance-manager',
      'finance-executive'
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
      'timeline',
      'finance-manager',
      'finance-executive'
    )
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;
