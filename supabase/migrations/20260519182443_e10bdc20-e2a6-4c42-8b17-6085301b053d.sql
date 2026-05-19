
-- Allow assigned techs to read the parent order
CREATE POLICY "Techs read orders for assigned work orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.order_id = orders.id
      AND wo.assigned_technician_id = auth.uid()
  )
);

-- Allow assigned engineers to read the parent order
CREATE POLICY "Engineers read orders for assigned work orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.order_id = orders.id
      AND wo.assigned_engineer_id = auth.uid()
  )
);

-- Allow assigned techs to read the client profile for their assigned jobs
CREATE POLICY "Techs read client profile for assigned work orders"
ON public.client_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.client_id = client_profiles.user_id
      AND wo.assigned_technician_id = auth.uid()
  )
);

-- Allow assigned engineers to read the client profile for their assigned jobs
CREATE POLICY "Engineers read client profile for assigned work orders"
ON public.client_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.client_id = client_profiles.user_id
      AND wo.assigned_engineer_id = auth.uid()
  )
);
