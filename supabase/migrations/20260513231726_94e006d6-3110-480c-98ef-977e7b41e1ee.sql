BEGIN;

UPDATE public.orders
SET services = array_replace(services, 'drainage', 'drainage-analysis')
WHERE 'drainage' = ANY(services);

UPDATE public.orders
SET services = array_replace(services, 'enhanced-fastener', 'fastener-calculation')
WHERE 'enhanced-fastener' = ANY(services);

UPDATE public.orders
SET services = array_replace(services, 'wind-mitigation', 'wind-mitigation-permit')
WHERE 'wind-mitigation' = ANY(services);

UPDATE public.work_orders SET service_type = 'drainage-analysis'      WHERE service_type = 'drainage';
UPDATE public.work_orders SET service_type = 'fastener-calculation'   WHERE service_type = 'enhanced-fastener';
UPDATE public.work_orders SET service_type = 'wind-mitigation-permit' WHERE service_type = 'wind-mitigation';

DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining FROM public.work_orders
   WHERE service_type IN ('drainage', 'enhanced-fastener', 'wind-mitigation');
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % work_orders still on old service_type', remaining;
  END IF;

  SELECT COUNT(*) INTO remaining FROM public.orders
   WHERE services && ARRAY['drainage', 'enhanced-fastener', 'wind-mitigation']::TEXT[];
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % orders still contain old service identifiers', remaining;
  END IF;
END $$;

COMMIT;