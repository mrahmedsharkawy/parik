-- ===== جداول متجر بريق =====

-- جدول الطلبات
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  address     JSONB,
  items       JSONB NOT NULL DEFAULT '[]',
  total       NUMERIC(10,2) DEFAULT 0,
  status      TEXT DEFAULT 'processing',
  cashback    NUMERIC(5,2) DEFAULT 5,
  cashback_status TEXT DEFAULT 'pending',
  cashback_expires_at TIMESTAMPTZ,
  coupon_code TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- جدول العملاء
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  phone       TEXT UNIQUE,
  email       TEXT,
  address     JSONB,
  total_orders INT DEFAULT 0,
  total_spent  NUMERIC(10,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  icon        TEXT DEFAULT '🔔',
  title       TEXT NOT NULL,
  msg         TEXT,
  order_id    TEXT REFERENCES orders(id),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- جدول إعدادات المتجر
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Row Level Security (اختياري - للحماية)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- السماح للعموم بالقراءة والكتابة (يمكن تضييقها لاحقاً)
CREATE POLICY "public_orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
