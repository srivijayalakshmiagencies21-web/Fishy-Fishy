-- Immutable copy of quantities entered at start (never updated by transfer/final truck_items writes).

CREATE TABLE public.start_truck_items (
  truck_id UUID NOT NULL REFERENCES public.journey_trucks(id) ON DELETE CASCADE,
  supplier_id BIGINT NOT NULL REFERENCES public.vendors(id),
  fish_id BIGINT NOT NULL REFERENCES public.fishes(id),
  quantity BIGINT NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (truck_id, supplier_id, fish_id)
);

ALTER TABLE public.start_truck_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access for authenticated users"
ON public.start_truck_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all write access for authenticated users"
ON public.start_truck_items FOR ALL TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.capture_start_truck_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.start_truck_items (truck_id, supplier_id, fish_id, quantity)
  VALUES (NEW.truck_id, NEW.supplier_id, NEW.fish_id, NEW.quantity)
  ON CONFLICT (truck_id, supplier_id, fish_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER truck_items_capture_start
AFTER INSERT ON public.truck_items
FOR EACH ROW
EXECUTE FUNCTION public.capture_start_truck_item();
