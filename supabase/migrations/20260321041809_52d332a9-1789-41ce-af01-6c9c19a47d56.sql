-- Allow technicians to delete from field-photos storage bucket
-- Row-level ownership is enforced at the DB layer (work_order_photos table)
CREATE POLICY "Techs delete field photos"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'field-photos'
  AND public.has_role(auth.uid(), 'technician')
);