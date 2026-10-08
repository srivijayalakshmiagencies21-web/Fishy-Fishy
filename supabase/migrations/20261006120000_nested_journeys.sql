-- Create journey_trucks table
CREATE TABLE public.journey_trucks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
    transporter_id BIGINT NOT NULL REFERENCES public.vendors(id),
    vehicle_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    odometer_reading BIGINT NOT NULL,
    odometer_image_path TEXT,
    end_type TEXT NOT NULL DEFAULT 'TRANSFER_POINT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.journey_trucks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access for authenticated users"
ON public.journey_trucks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all write access for authenticated users"
ON public.journey_trucks FOR ALL
TO authenticated
USING (true);

-- Create truck_items table for vendor seeds/fishes
CREATE TABLE public.truck_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id UUID NOT NULL REFERENCES public.journey_trucks(id) ON DELETE CASCADE,
    supplier_id BIGINT NOT NULL REFERENCES public.vendors(id),
    fish_id BIGINT NOT NULL REFERENCES public.fishes(id),
    quantity BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.truck_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access for authenticated users"
ON public.truck_items FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all write access for authenticated users"
ON public.truck_items FOR ALL
TO authenticated
USING (true);

-- Wipe existing journeys data since it's no longer needed in the old format
TRUNCATE TABLE public.journeys CASCADE;

-- Drop obsolete flat columns from journeys
ALTER TABLE public.journeys
  DROP COLUMN supplier_id,
  DROP COLUMN fish_id,
  DROP COLUMN quantity,
  DROP COLUMN transporter_id,
  DROP COLUMN vehicle_number,
  DROP COLUMN driver_name,
  DROP COLUMN driver_phone,
  DROP COLUMN odometer_reading,
  DROP COLUMN end_type,
  DROP COLUMN odometer_image_path;
