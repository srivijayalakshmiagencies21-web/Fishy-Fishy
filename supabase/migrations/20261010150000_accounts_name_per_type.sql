drop index if exists public.accounts_name_unique;

create unique index accounts_name_type_unique
  on public.accounts (lower(btrim(name)), account_type);
