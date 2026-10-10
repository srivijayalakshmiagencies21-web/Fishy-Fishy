-- Editable rates on Journey Rates page (per journey line).

create table public.journey_rate_lines (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  line_key text not null,
  rate numeric,
  updated_at timestamptz not null default now(),
  constraint journey_rate_lines_line_key_not_blank check (char_length(btrim(line_key)) > 0),
  primary key (journey_id, line_key)
);

comment on table public.journey_rate_lines is 'User-entered rates for supplier qty / transporter km lines on Journey Rates.';

alter table public.journey_rate_lines enable row level security;

create policy journey_rate_lines_select
  on public.journey_rate_lines for select
  to authenticated
  using (true);

create policy journey_rate_lines_write
  on public.journey_rate_lines for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.journey_rate_lines to authenticated;
grant all on public.journey_rate_lines to service_role;
