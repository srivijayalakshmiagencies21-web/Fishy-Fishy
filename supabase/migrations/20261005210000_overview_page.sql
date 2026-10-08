ALTER TABLE public.roles DROP CONSTRAINT roles_pages_known;
ALTER TABLE public.roles ADD CONSTRAINT roles_pages_known CHECK (allowed_pages <@ ARRAY['masters', 'users', 'start', 'transfer', 'final', 'overview']);
