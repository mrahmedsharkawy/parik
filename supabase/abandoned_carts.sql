-- Abandoned cart reminder queue
-- Run in Supabase SQL Editor, then deploy/schedule the Edge Function when ready.

CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id                  bigserial PRIMARY KEY,
  endpoint            text UNIQUE NOT NULL,
  user_phone          text DEFAULT '',
  user_email          text DEFAULT '',
  user_lang           text DEFAULT 'ar',
  cart_count          integer NOT NULL DEFAULT 0,
  cart_total          numeric(12,2) DEFAULT 0,
  cart_currency       text DEFAULT 'AED',
  first_product_name  text DEFAULT '',
  first_product_image text DEFAULT '',
  cart_hash           text DEFAULT '',
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'cleared')),
  scheduled_at        timestamptz NOT NULL DEFAULT (now() + interval '45 minutes'),
  last_cart_at        timestamptz NOT NULL DEFAULT now(),
  notified_at         timestamptz,
  send_attempts       integer NOT NULL DEFAULT 0,
  last_error          text DEFAULT '',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS abandoned_carts_due_idx
  ON public.abandoned_carts (status, scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can upsert own abandoned cart" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can update own abandoned cart" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Service role can read abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Service role can update abandoned carts" ON public.abandoned_carts;

CREATE POLICY "Anyone can upsert own abandoned cart" ON public.abandoned_carts
  FOR INSERT WITH CHECK (true);

-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS for SELECT/UPDATE.
