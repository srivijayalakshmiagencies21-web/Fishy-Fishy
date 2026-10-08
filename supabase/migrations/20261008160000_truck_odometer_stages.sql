-- Preserve odometer at each leg (start / transfer / final) so distance = sum of leg deltas.

ALTER TABLE public.journey_trucks
  ADD COLUMN IF NOT EXISTS start_odometer_reading BIGINT,
  ADD COLUMN IF NOT EXISTS transfer_odometer_reading BIGINT,
  ADD COLUMN IF NOT EXISTS final_odometer_reading BIGINT;

-- Best-effort backfill from the latest stored image path on each truck row.
UPDATE public.journey_trucks
SET start_odometer_reading = (regexp_match(odometer_image_path, '/SP/(\d+)\.'))[1]::bigint
WHERE start_odometer_reading IS NULL
  AND odometer_image_path ~ '/SP/\d+\.';

UPDATE public.journey_trucks
SET transfer_odometer_reading = (regexp_match(odometer_image_path, '/TP/(\d+)\.'))[1]::bigint
WHERE transfer_odometer_reading IS NULL
  AND odometer_image_path ~ '/TP/\d+\.';

UPDATE public.journey_trucks
SET final_odometer_reading = (regexp_match(odometer_image_path, '/FP/(\d+)\.'))[1]::bigint
WHERE final_odometer_reading IS NULL
  AND odometer_image_path ~ '/FP/\d+\.';

-- When only the live reading column is populated, copy it into the matching stage column.
UPDATE public.journey_trucks
SET start_odometer_reading = odometer_reading
WHERE start_odometer_reading IS NULL
  AND odometer_image_path ~ '/SP/';

UPDATE public.journey_trucks
SET transfer_odometer_reading = odometer_reading
WHERE transfer_odometer_reading IS NULL
  AND odometer_image_path ~ '/TP/';

UPDATE public.journey_trucks
SET final_odometer_reading = odometer_reading
WHERE final_odometer_reading IS NULL
  AND odometer_image_path ~ '/FP/';
