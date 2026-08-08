-- Phase 3: operational scale — human-readable numbers, search, indexes

-- Trigram search support for address / company lookups
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Human-readable order numbers ─────────────────────────────────────
-- Sequential, phone-friendly references (#1001, #1002, …) instead of
-- UUID prefixes. Backfilled in creation order for existing rows.
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE;
ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT nextval('public.order_number_seq');

WITH numbered AS (
  SELECT id, nextval('public.order_number_seq') AS n
  FROM public.orders
  WHERE order_number IS NULL
  ORDER BY created_at
)
UPDATE public.orders o
SET order_number = numbered.n
FROM numbered
WHERE o.id = numbered.id;

CREATE SEQUENCE IF NOT EXISTS public.wo_number_seq START 1001;
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS wo_number INTEGER UNIQUE;
ALTER TABLE public.work_orders
  ALTER COLUMN wo_number SET DEFAULT nextval('public.wo_number_seq');

WITH numbered AS (
  SELECT id, nextval('public.wo_number_seq') AS n
  FROM public.work_orders
  WHERE wo_number IS NULL
  ORDER BY created_at
)
UPDATE public.work_orders w
SET wo_number = numbered.n
FROM numbered
WHERE w.id = numbered.id;

-- ── Indexes for the actual admin access patterns ─────────────────────
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at
  ON public.work_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_status_created
  ON public.work_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_submitted_at
  ON public.work_orders (submitted_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_signed_at
  ON public.work_orders (signed_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- Text search: job address and client company
CREATE INDEX IF NOT EXISTS idx_orders_job_address_trgm
  ON public.orders USING gin (job_address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_client_profiles_company_trgm
  ON public.client_profiles USING gin (company_name gin_trgm_ops);
