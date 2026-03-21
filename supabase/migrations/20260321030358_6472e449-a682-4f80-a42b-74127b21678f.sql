CREATE POLICY "Techs read photos on assigned work orders"
ON public.work_order_photos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id
    AND wo.assigned_technician_id = auth.uid()
  )
);