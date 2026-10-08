CREATE TABLE public.truck_unload_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES public.journey_trucks(id) ON DELETE CASCADE,
  society_id BIGINT NOT NULL REFERENCES public.societies(id),
  supplier_id BIGINT NOT NULL REFERENCES public.vendors(id),
  fish_id BIGINT NOT NULL REFERENCES public.fishes(id),
  quantity BIGINT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.truck_unload_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access for authenticated users"
ON public.truck_unload_drops FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all write access for authenticated users"
ON public.truck_unload_drops FOR ALL TO authenticated USING (true);

CREATE INDEX truck_unload_drops_truck_id_idx ON public.truck_unload_drops (truck_id);
