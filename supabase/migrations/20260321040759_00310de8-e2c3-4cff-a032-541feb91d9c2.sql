-- Fix 2: Allow engineers to update work orders assigned to them
CREATE POLICY "Engineers update assigned work orders"
ON public.work_orders
FOR UPDATE TO authenticated
USING (auth.uid() = assigned_engineer_id)
WITH CHECK (auth.uid() = assigned_engineer_id);

-- Fix 7: Allow techs to insert photos on their assigned work orders
CREATE POLICY "Techs insert photos on assigned work orders"
ON public.work_order_photos
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id
    AND wo.assigned_technician_id = auth.uid()
  )
);

-- Fix 7: Allow techs to delete photos on their assigned work orders
CREATE POLICY "Techs delete photos on assigned work orders"
ON public.work_order_photos
FOR DELETE TO authenticated
USING (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id
    AND wo.assigned_technician_id = auth.uid()
  )
);

-- Fix 7: Allow techs to update caption on their own photos
CREATE POLICY "Techs update own photo captions"
ON public.work_order_photos
FOR UPDATE TO authenticated
USING (auth.uid() = uploaded_by)
WITH CHECK (auth.uid() = uploaded_by);

-- Additional: field_data readable by techs on assigned work orders
DROP POLICY IF EXISTS "Techs read own field data" ON public.field_data;

CREATE POLICY "Techs read field data on assigned work orders"
ON public.field_data
FOR SELECT TO authenticated
USING (
  auth.uid() = submitted_by
  OR EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id
    AND wo.assigned_technician_id = auth.uid()
  )
);