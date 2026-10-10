-- Remove redundant "Personal" / "Business" wording from account names (type is already on account_type).
update public.accounts
set name = btrim(
  regexp_replace(
    replace(replace(name, ' Personal', ''), ' Business', ''),
    '\s+',
    ' ',
    'g'
  )
)
where name ilike '%personal%' or name ilike '%business%';
