
-- Allow clients to insert their own orders
CREATE POLICY "Clients insert own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);
