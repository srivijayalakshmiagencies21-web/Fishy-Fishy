ALTER TABLE public.journey_trucks
  ADD COLUMN primary_truck_id UUID REFERENCES public.journey_trucks(id) ON DELETE SET NULL;

CREATE INDEX journey_trucks_primary_truck_id_idx ON public.journey_trucks (primary_truck_id);
