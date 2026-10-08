-- Move origin details to the truck scope
ALTER TABLE public.journey_trucks
  ADD COLUMN location_name TEXT NOT NULL DEFAULT 'Unknown',
  ADD COLUMN district_id BIGINT REFERENCES public.districts(id);

-- Drop from journeys
ALTER TABLE public.journeys
  DROP COLUMN location_name,
  DROP COLUMN district_id;
