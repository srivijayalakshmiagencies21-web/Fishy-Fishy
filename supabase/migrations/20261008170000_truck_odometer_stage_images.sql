-- Add stage-specific odometer image paths so start, transfer, and final photos are preserved independently.

ALTER TABLE public.journey_trucks
  ADD COLUMN IF NOT EXISTS start_odometer_image_path TEXT,
  ADD COLUMN IF NOT EXISTS transfer_odometer_image_path TEXT,
  ADD COLUMN IF NOT EXISTS final_odometer_image_path TEXT;

-- Backfill stage image paths from odometer_image_path if available
UPDATE public.journey_trucks
SET start_odometer_image_path = odometer_image_path
WHERE start_odometer_image_path IS NULL
  AND odometer_image_path ~ '/SP/';

UPDATE public.journey_trucks
SET transfer_odometer_image_path = odometer_image_path
WHERE transfer_odometer_image_path IS NULL
  AND odometer_image_path ~ '/TP/';

UPDATE public.journey_trucks
SET final_odometer_image_path = odometer_image_path
WHERE final_odometer_image_path IS NULL
  AND odometer_image_path ~ '/FP/';
