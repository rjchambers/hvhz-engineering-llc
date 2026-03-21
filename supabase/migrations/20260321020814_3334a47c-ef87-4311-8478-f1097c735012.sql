
-- ============================================
-- HVHZ Engineering Complete Database Schema
-- ============================================

-- 1. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','client','technician','engineer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. user_roles RLS
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Auto-assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. client_profiles
CREATE TABLE public.client_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  company_address TEXT,
  company_city TEXT,
  company_state TEXT DEFAULT 'FL',
  company_zip TEXT,
  stripe_customer_id TEXT,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own client profile" ON public.client_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own client profile" ON public.client_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own client profile" ON public.client_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all client profiles" ON public.client_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  services TEXT[] NOT NULL,
  job_address TEXT,
  job_city TEXT,
  job_zip TEXT,
  job_county TEXT,
  roof_area_sqft INTEGER,
  roof_data JSONB DEFAULT '{}',
  total_amount NUMERIC(10,2),
  distance_fee NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Admins read all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete orders" ON public.orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. work_orders
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_dispatch',
  assigned_technician_id UUID REFERENCES auth.users(id),
  assigned_engineer_id UUID REFERENCES auth.users(id),
  scheduled_date DATE,
  outsource_company TEXT,
  outsource_email_sent_at TIMESTAMPTZ,
  result_pdf_url TEXT,
  unsigned_report_url TEXT,
  signed_report_url TEXT,
  pe_notes TEXT,
  rejection_notes TEXT,
  submitted_at TIMESTAMPTZ,
  pe_reviewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own work orders" ON public.work_orders
  FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Techs read assigned work orders" ON public.work_orders
  FOR SELECT TO authenticated USING (auth.uid() = assigned_technician_id);
CREATE POLICY "Engineers read assigned work orders" ON public.work_orders
  FOR SELECT TO authenticated USING (auth.uid() = assigned_engineer_id);
CREATE POLICY "Admins read all work orders" ON public.work_orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert work orders" ON public.work_orders
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update work orders" ON public.work_orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete work orders" ON public.work_orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. field_data
CREATE TABLE public.field_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID UNIQUE NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}',
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.field_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Techs insert own field data" ON public.field_data
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by);
CREATE POLICY "Techs update own field data" ON public.field_data
  FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by);
CREATE POLICY "Engineers read field data" ON public.field_data
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'engineer'));
CREATE POLICY "Admins manage all field data" ON public.field_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 10. work_order_photos
CREATE TABLE public.work_order_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  storage_path TEXT NOT NULL,
  caption TEXT,
  section_tag TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Techs insert photos for assigned WOs" ON public.work_order_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id AND wo.assigned_technician_id = auth.uid()
    )
  );
CREATE POLICY "Engineers read all photos" ON public.work_order_photos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'engineer'));
CREATE POLICY "Admins manage all photos" ON public.work_order_photos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. engineer_profiles
CREATE TABLE public.engineer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  pe_license_number TEXT,
  pe_license_state TEXT DEFAULT 'FL',
  pe_expiry DATE,
  stamp_image_url TEXT,
  signature_image_url TEXT,
  p12_certificate_path TEXT,
  digital_signing_enabled BOOLEAN DEFAULT false,
  firm_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.engineer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engineers read own profile" ON public.engineer_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Engineers insert own profile" ON public.engineer_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Engineers update own profile" ON public.engineer_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all engineer profiles" ON public.engineer_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_engineer_profiles_updated_at
  BEFORE UPDATE ON public.engineer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. signed_documents
CREATE TABLE public.signed_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID UNIQUE NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  signed_by UUID NOT NULL REFERENCES auth.users(id),
  signed_pdf_url TEXT NOT NULL,
  signing_method TEXT DEFAULT 'image-stamp',
  fac_rule_ref TEXT DEFAULT 'FAC 61G15-23.004',
  is_cryptographically_signed BOOLEAN DEFAULT false,
  pe_notes TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.signed_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own signed docs" ON public.signed_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id AND wo.client_id = auth.uid()
    )
  );
CREATE POLICY "Admins read all signed docs" ON public.signed_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Engineers insert signed docs" ON public.signed_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'engineer'));

-- 13. Storage buckets (all private)
INSERT INTO storage.buckets (id, name, public) VALUES ('field-photos', 'field-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('pe-credentials', 'pe-credentials', false);

-- field-photos storage policies
CREATE POLICY "Techs upload field photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-photos' AND public.has_role(auth.uid(), 'technician'));
CREATE POLICY "Engineers read field photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'field-photos' AND public.has_role(auth.uid(), 'engineer'));
CREATE POLICY "Admins read field photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'field-photos' AND public.has_role(auth.uid(), 'admin'));

-- reports storage policies
CREATE POLICY "Admins upload reports" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Engineers read reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND public.has_role(auth.uid(), 'engineer'));
CREATE POLICY "Clients read own reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins read all reports" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND public.has_role(auth.uid(), 'admin'));

-- pe-credentials storage policies
CREATE POLICY "Engineers upload own credentials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pe-credentials' AND auth.uid()::text = (storage.foldername(name))[1] AND public.has_role(auth.uid(), 'engineer'));
CREATE POLICY "Admins read pe credentials" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pe-credentials' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Engineers read own credentials" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pe-credentials' AND auth.uid()::text = (storage.foldername(name))[1] AND public.has_role(auth.uid(), 'engineer'));

-- 14. Indexes
CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_work_orders_order_id ON public.work_orders(order_id);
CREATE INDEX idx_work_orders_client_id ON public.work_orders(client_id);
CREATE INDEX idx_work_orders_technician ON public.work_orders(assigned_technician_id);
CREATE INDEX idx_work_orders_engineer ON public.work_orders(assigned_engineer_id);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_work_order_photos_wo ON public.work_order_photos(work_order_id);
CREATE INDEX idx_field_data_wo ON public.field_data(work_order_id);
