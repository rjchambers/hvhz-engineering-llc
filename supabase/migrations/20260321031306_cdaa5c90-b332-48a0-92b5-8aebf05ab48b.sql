-- outsource_partners table
CREATE TABLE public.outsource_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',
  email_template TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.outsource_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage outsource partners"
  ON public.outsource_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_outsource_partners_updated_at
  BEFORE UPDATE ON public.outsource_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- service_config table
CREATE TABLE public.service_config (
  service_key TEXT PRIMARY KEY,
  price_override NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage service config"
  ON public.service_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default partners
INSERT INTO public.outsource_partners (name, contact_name, contact_email, services, email_template) VALUES
(
  'Florida Testing Labs',
  'Lab Coordinator',
  'orders@floridalabs.example.com',
  ARRAY['tas-105','tas-106','tas-124','tas-126'],
  E'Dear {{contact_name}},\n\nWe are submitting a work order for {{service_name}} at the following property:\n\nProperty Address: {{job_address}}, {{job_city}}, FL {{job_zip}}\nClient: {{client_company}}\nWork Order #: {{work_order_id}}\nRequested Date: {{scheduled_date}}\n\nPlease confirm receipt and provide an estimated turnaround time.\n\nThank you,\nHVHZ Engineering\n750 E Sample Rd, Pompano Beach FL 33064'
),
(
  'South Florida Testing Inc',
  'Dispatch',
  'dispatch@sftesting.example.com',
  ARRAY['tas-105','tas-106'],
  E'Dear {{contact_name}},\n\nWork order submission for {{service_name}}:\n\nAddress: {{job_address}}, {{job_city}}\nClient: {{client_company}}\nWO #: {{work_order_id}}\n\nPlease advise on scheduling.\n\nHVHZ Engineering'
);