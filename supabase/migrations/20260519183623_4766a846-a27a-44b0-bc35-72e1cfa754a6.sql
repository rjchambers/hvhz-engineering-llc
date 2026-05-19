CREATE POLICY "Techs read reports for assigned work orders"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1
    FROM public.work_orders wo
    JOIN public.orders o ON o.id = wo.order_id
    WHERE wo.assigned_technician_id = auth.uid()
      AND (
        o.noa_document_path = storage.objects.name
        OR o.roof_report_path = storage.objects.name
      )
  )
);