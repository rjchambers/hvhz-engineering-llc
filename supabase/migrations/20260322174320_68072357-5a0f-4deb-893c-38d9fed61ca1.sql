-- 1. Add client upload tracking and site context to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS noa_document_path TEXT,
  ADD COLUMN IF NOT EXISTS noa_document_name TEXT,
  ADD COLUMN IF NOT EXISTS roof_report_path TEXT,
  ADD COLUMN IF NOT EXISTS roof_report_name TEXT,
  ADD COLUMN IF NOT EXISTS roof_report_type TEXT,
  ADD COLUMN IF NOT EXISTS gated_community BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gate_code TEXT,
  ADD COLUMN IF NOT EXISTS site_context JSONB DEFAULT '{}';

-- 2. Add calculation_results to field_data
ALTER TABLE public.field_data
  ADD COLUMN IF NOT EXISTS calculation_results JSONB DEFAULT '{}';

-- 3. Allow clients to upload to 'reports' bucket
CREATE POLICY "Clients upload order documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND public.has_role(auth.uid(), 'client')
  );

-- 4. Allow clients to read their own uploaded documents
CREATE POLICY "Clients read own uploaded docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND public.has_role(auth.uid(), 'client')
  );