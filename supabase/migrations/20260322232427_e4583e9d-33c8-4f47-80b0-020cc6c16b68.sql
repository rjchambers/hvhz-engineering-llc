
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage app_config" ON public.app_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated read app_config" ON public.app_config
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.app_config (key, value) VALUES
  ('default_technician_id', ''),
  ('default_engineer_id', '');
