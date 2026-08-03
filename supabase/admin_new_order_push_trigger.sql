-- إشعار الأدمن عند إنشاء طلب جديد
-- شغّل هذا الملف مرة واحدة من Supabase Dashboard -> SQL Editor
-- لا ينشئ جدولاً جديداً؛ يضيف trigger فقط على جدول orders.

create extension if not exists pg_net with schema extensions;

alter table public.orders
  add column if not exists order_number text;

create or replace function public.notify_admin_new_order_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtubGVlaGpqZWpmZW9iY21wd253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjk1NzAsImV4cCI6MjA5OTYwNTU3MH0.Q5Peb8CXDYNSPtQJGK6meij4vFRfOUq9qFz4rHBXE8E';
  order_ref text := coalesce(new.order_number, new.id::text);
  item_count int := 1;
  customer text := coalesce(nullif(new.customer_name, ''), 'عميل');
  total_text text := trim(to_char(coalesce(new.total, 0), 'FM999999999990.00')) || ' AED';
begin
  if jsonb_typeof(new.items) = 'array' then
    select greatest(1, coalesce(sum(coalesce((item->>'qty')::int, (item->>'quantity')::int, 1)), 0))
      into item_count
      from jsonb_array_elements(new.items) as item;
  end if;

  perform net.http_post(
    url := 'https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/hyper-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'title', U&'\0637\0644\0628 \062C\062F\064A\062F \0645\0646 Bariq',
      'body', U&'\0637\0644\0628 #' || order_ref || ' - ' || total_text || E'\n' || U&'\0627\0644\0639\0645\064A\0644: ' || customer || E'\n' || U&'\0627\0636\063A\0637 \0644\0641\062A\062D \0627\0644\0637\0644\0628',
      'url', '/admin-reports?order=' || order_ref,
      'type', 'admin_new_order',
      'orderId', order_ref,
      'order_id', order_ref,
      'iconText', '📦',
      'emoji', '📦',
      'user_email', '__bariq_admin_orders__@bariq.local'
    )
  );

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists orders_admin_new_order_push on public.orders;
create trigger orders_admin_new_order_push
after insert on public.orders
for each row
execute function public.notify_admin_new_order_push();
