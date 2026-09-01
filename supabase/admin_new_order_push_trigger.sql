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
set search_path = pg_catalog
as $$
declare
  secret_key text := (
    select decrypted_secret
    from vault.decrypted_secrets
    where name = 'bariq_supabase_secret_key'
    limit 1
  );
  order_ref text := coalesce(new.order_number, new.id::text);
  clean_order_ref text := regexp_replace(coalesce(new.order_number, new.id::text), '^#', '');
  item_count int := 1;
  customer text := coalesce(nullif(new.customer_name, ''), 'Customer');
  customer_email text := lower(trim(coalesce(new.customer_email, '')));
  customer_phone text := trim(coalesce(new.customer_phone, ''));
  cashback_amount numeric := greatest(0, coalesce(new.cashback, 0));
  product_name text := 'Product';
  total_text text := trim(to_char(coalesce(new.total, 0), 'FM999999999990.00')) || ' AED';
begin
  if jsonb_typeof(new.items) = 'array' then
    select greatest(1, coalesce(sum(coalesce((item->>'qty')::int, (item->>'quantity')::int, 1)), 0))
      into item_count
      from jsonb_array_elements(new.items) as item;

    select coalesce(nullif(item->>'name', ''), nullif(item->>'title', ''), nullif(item->>'productName', ''), nullif(item->>'product_name', ''), 'Product')
      into product_name
      from jsonb_array_elements(new.items) as item
      limit 1;
  end if;

  perform net.http_post(
    url := 'https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/hyper-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Origin', 'https://bariqgifts.com',
      'apikey', secret_key
    ),
    body := jsonb_build_object(
      'title', 'admin_new_order',
      'body', 'order #' || order_ref || ' - ' || total_text,
      'customerName', customer,
      'productName', product_name,
      'totalText', total_text,
      'url', '/admin-reports?order=' || order_ref,
      'type', 'admin_new_order',
      'orderId', order_ref,
      'order_id', order_ref,
      'iconText', '📦',
      'emoji', '📦',
      'user_email', '__bariq_admin_orders__@bariq.local'
    )
  );

  -- Customer purchase confirmation: the app already derives the matching
  -- inbox card from the order row, so this call delivers Web Push + FCM only
  -- and avoids a duplicate card inside the notifications screen.
  if customer_email <> '' or customer_phone <> '' then
    perform net.http_post(
      url := 'https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/send-native-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', secret_key
      ),
      body := jsonb_build_object(
        'title', '✅ تم استلام طلبك',
        'title_ar', '✅ تم استلام طلبك',
        'title_en', '✅ Your order was received',
        'body', 'تم تسجيل طلبك رقم #' || clean_order_ref || ' بقيمة ' || total_text || ' وسيتم التواصل معك لتأكيد التفاصيل.',
        'body_ar', 'تم تسجيل طلبك رقم #' || clean_order_ref || ' بقيمة ' || total_text || ' وسيتم التواصل معك لتأكيد التفاصيل.',
        'body_en', 'Order #' || clean_order_ref || ' was received for ' || total_text || '. We will contact you to confirm the details.',
        'type', 'order_status',
        'status', 'processing',
        'order_status', 'processing',
        'order_id', clean_order_ref,
        'url', '/account?section=orders',
        'icon', '✅',
        'user_email', nullif(customer_email, ''),
        'user_phone', nullif(customer_phone, ''),
        'save_inbox', false
      )
    );

    if cashback_amount > 0 then
      perform net.http_post(
        url := 'https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/send-native-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', secret_key
        ),
        body := jsonb_build_object(
          'title', '🤑 كاش باك بانتظارك',
          'title_ar', '🤑 كاش باك بانتظارك',
          'title_en', '🤑 Your cashback is waiting',
          'body', 'حصلت على ' || trim(to_char(cashback_amount, 'FM999999999990.00')) || ' د.إ كاش باك من طلبك رقم #' || clean_order_ref || '. سيتم تفعيله بعد اعتماد الطلب.',
          'body_ar', 'حصلت على ' || trim(to_char(cashback_amount, 'FM999999999990.00')) || ' د.إ كاش باك من طلبك رقم #' || clean_order_ref || '. سيتم تفعيله بعد اعتماد الطلب.',
          'body_en', 'You earned ' || trim(to_char(cashback_amount, 'FM999999999990.00')) || ' AED cashback from order #' || clean_order_ref || '. It will be activated after order approval.',
          'type', 'cashback',
          'order_id', clean_order_ref,
          'url', '/account?section=wallet',
          'icon', '🤑',
          'user_email', nullif(customer_email, ''),
          'user_phone', nullif(customer_phone, ''),
          'save_inbox', false
        )
      );
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

revoke execute on function public.notify_admin_new_order_push() from public, anon, authenticated;

drop trigger if exists orders_admin_new_order_push on public.orders;
create trigger orders_admin_new_order_push
after insert on public.orders
for each row
execute function public.notify_admin_new_order_push();
