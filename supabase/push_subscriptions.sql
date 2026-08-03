-- إنشاء جدول اشتراكات Push Notifications
-- انسخ هذا الكود وشغّله في Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          bigserial PRIMARY KEY,
  endpoint    text UNIQUE NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_phone  text DEFAULT '',
  user_email  text DEFAULT '',
  user_lang   text DEFAULT 'ar',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_lang text DEFAULT 'ar';

-- السماح للمستخدمين بالإضافة (anon key)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can update own subscription" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can read count" ON push_subscriptions;
DROP POLICY IF EXISTS "Service role can delete" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can refresh subscription" ON push_subscriptions;
DROP POLICY IF EXISTS "Active admins can read push subscriptions" ON push_subscriptions;

CREATE POLICY "Anyone can subscribe" ON push_subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can refresh subscription" ON push_subscriptions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Active admins can read push subscriptions" ON push_subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admins a
      WHERE a.active = true
        AND (a.user_id = auth.uid() OR lower(a.email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- Deletes are handled by Edge Functions using the service role key, which bypasses RLS.
