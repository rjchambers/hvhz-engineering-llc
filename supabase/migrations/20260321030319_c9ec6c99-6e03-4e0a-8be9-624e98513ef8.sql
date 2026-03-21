-- BUG 1: Allow technicians to read their own field_data submissions
CREATE POLICY "Techs read own field data"
ON public.field_data
FOR SELECT TO authenticated
USING (auth.uid() = submitted_by);

-- BUG 2: Allow technicians to update status on their assigned work orders
CREATE POLICY "Techs update assigned work orders"
ON public.work_orders
FOR UPDATE TO authenticated
USING (auth.uid() = assigned_technician_id)
WITH CHECK (auth.uid() = assigned_technician_id);

-- BUG 3: Allow engineers to upload signed reports to the reports bucket
CREATE POLICY "Engineers upload signed reports"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND public.has_role(auth.uid(), 'engineer')
);