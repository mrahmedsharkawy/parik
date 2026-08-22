-- Bariq Push repair migration
-- Run before deploying the final notifications.js + hyper-api.

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS vapid_public_key text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_vapid_public_key
  ON public.push_subscriptions(vapid_public_key);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_phone_vapid
  ON public.push_subscriptions(user_phone, vapid_public_key);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email_vapid
  ON public.push_subscriptions(lower(user_email), vapid_public_key);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.push_subscriptions;
CREATE POLICY "Anyone can subscribe"
  ON public.push_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can refresh subscription" ON public.push_subscriptions;
CREATE POLICY "Anyone can refresh subscription"
  ON public.push_subscriptions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Keep admin read policy if it already exists.
-- Do not grant public SELECT/DELETE. The Edge Function uses service_role for cleanup.
