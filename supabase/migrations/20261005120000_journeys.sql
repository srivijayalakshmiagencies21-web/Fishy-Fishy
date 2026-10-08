CREATE TABLE public.journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id TEXT NOT NULL DEFAULT ('JRN-' || upper(substr(md5(random()::text), 1, 4))),
    supplier_id BIGINT NOT NULL REFERENCES public.vendors(id),
    fish_id BIGINT NOT NULL REFERENCES public.fishes(id),
    quantity BIGINT NOT NULL,
    transporter_id BIGINT NOT NULL REFERENCES public.vendors(id),
    vehicle_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    odometer_reading BIGINT NOT NULL,
    odometer_image_path TEXT,
    location_name TEXT NOT NULL,
    district_id BIGINT NOT NULL REFERENCES public.districts(id),
    status TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access for authenticated users"
ON public.journeys FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all write access for authenticated users"
ON public.journeys FOR ALL
TO authenticated
USING (true);
