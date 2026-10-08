-- Replace legacy status values with workflow phase names; column renamed to phase.
ALTER TABLE public.journeys RENAME COLUMN status TO phase;

UPDATE public.journeys
SET phase = CASE phase
  WHEN 'IN_TRANSIT' THEN 'start'
  WHEN 'AT_TRANSFER' THEN 'transfer'
  WHEN 'UNLOADING' THEN 'final'
  WHEN 'COMPLETED' THEN 'closed'
  ELSE phase
END;

ALTER TABLE public.journeys ALTER COLUMN phase SET DEFAULT 'start';
