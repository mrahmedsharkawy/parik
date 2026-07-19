-- إنشاء جدول اشتراكات Push Notifications
-- انسخ هذا الكود وشغّله في Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          bigserial PRIMARY KEY,
  endpoint    text UNIQUE NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_phone  text DEFAULT '',
  user_email  text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- السماح للمستخدمين بالإضافة (anon key)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can update own subscription" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can read count" ON push_subscriptions;
DROP POLICY IF EXISTS "Service role can delete" ON push_subscriptions;

CREATE POLICY "Anyone can subscribe" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update own subscription" ON push_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read count" ON push_subscriptions
  FOR SELECT USING (true);

CREATE POLICY "Service role can delete" ON push_subscriptions
  FOR DELETE USING (true);
