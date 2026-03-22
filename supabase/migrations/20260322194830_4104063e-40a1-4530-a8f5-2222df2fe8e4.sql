ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS contractor_license TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS tech_instructions TEXT;