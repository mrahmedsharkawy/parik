-- Storefront controls used by admin.html and index.html
-- Run once in Supabase SQL editor.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS product_sort TEXT DEFAULT 'daily_random';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS daily_picks JSONB DEFAULT '[]'::jsonb;

UPDATE settings
SET product_sort = COALESCE(product_sort, 'daily_random'),
    daily_picks = COALESCE(daily_picks, '[]'::jsonb);