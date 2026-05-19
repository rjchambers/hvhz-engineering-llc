-- Replace tech INSERT policy to allow any assigned tech
DROP POLICY IF EXISTS "Techs insert own field data" ON public.field_data;

CREATE POLICY "Techs insert field data for assigned work orders"
ON public.field_data
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = submitted_by
  AND EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = field_data.work_order_id
      AND wo.assigned_technician_id = auth.uid()
  )
);

-- Replace tech UPDATE policy to allow any assigned tech (not just original submitter)
DROP POLICY IF EXISTS "Techs update own field data" ON public.field_data;

CREATE POLICY "Techs update field data for assigned work orders"
ON public.field_data
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = field_data.work_order_id
      AND wo.assigned_technician_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = field_data.work_order_id
      AND wo.assigned_technician_id = auth.uid()
  )
);