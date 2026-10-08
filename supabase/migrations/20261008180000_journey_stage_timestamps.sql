-- Add stage-specific timestamp columns to journeys table.

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS transfer_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS final_at TIMESTAMP WITH TIME ZONE;
