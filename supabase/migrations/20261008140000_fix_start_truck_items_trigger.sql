-- Only snapshot positive quantities on start primaries (ignore transfer/final truck_items writes).

CREATE OR REPLACE FUNCTION public.capture_start_truck_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.journey_trucks jt
    WHERE jt.id = NEW.truck_id
      AND jt.primary_truck_id IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.start_truck_items (truck_id, supplier_id, fish_id, quantity)
  VALUES (NEW.truck_id, NEW.supplier_id, NEW.fish_id, NEW.quantity)
  ON CONFLICT (truck_id, supplier_id, fish_id) DO NOTHING;

  RETURN NEW;
END;
$$;
