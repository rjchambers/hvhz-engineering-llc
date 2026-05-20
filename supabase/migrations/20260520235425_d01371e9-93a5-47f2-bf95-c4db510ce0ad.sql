
-- Allow technicians to upload completed-report PDFs for their assigned work orders
CREATE POLICY "Techs upload reports for assigned WOs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'work_orders'
  AND EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id::text = (storage.foldername(name))[2]
      AND wo.assigned_technician_id = auth.uid()
  )
);

CREATE POLICY "Techs update reports for assigned WOs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'reports'
  AND (storage.foldername(name))[1] = 'work_orders'
  AND EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id::text = (storage.foldername(name))[2]
      AND wo.assigned_technician_id = auth.uid()
  )
);
