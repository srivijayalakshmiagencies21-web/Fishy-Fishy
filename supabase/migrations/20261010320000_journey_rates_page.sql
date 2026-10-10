-- Workspace page: Journey Rates (closed journey start qty + transporter km by scope).

alter table public.roles drop constraint if exists roles_pages_known;

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
      'journey-rates',
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
      'journey-rates',
      'finance-manager',
      'finance-executive'
    )
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;

update public.roles
set allowed_pages = array_append(allowed_pages, 'journey-rates')
where ('timeline' = any (allowed_pages) or 'finance-manager' = any (allowed_pages))
  and not ('journey-rates' = any (allowed_pages));
