alter table public.roles drop constraint roles_pages_known;

alter table public.roles
  add constraint roles_pages_known
  check (allowed_pages <@ array['masters', 'users', 'start', 'transfer', 'final']::text[]);

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
    where page not in ('masters', 'users', 'start', 'transfer', 'final')
  ) then
    raise exception 'Unknown page';
  end if;
end;
$$;

update public.roles
set allowed_pages = allowed_pages || array['start', 'transfer', 'final']
where name = 'Admin'
  and is_system
  and not (allowed_pages @> array['start', 'transfer', 'final']);
