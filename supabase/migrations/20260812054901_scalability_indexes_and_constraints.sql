-- Bariq Gifts scalability guardrails.
-- Safe additive indexes for the paginated browser/API queries added in this change.

create index if not exists idx_orders_created_at_desc
  on public.orders (created_at desc);

create index if not exists idx_orders_status_created_at_desc
  on public.orders (status, created_at desc);

create index if not exists idx_orders_customer_id_created_at_desc
  on public.orders (customer_id, created_at desc);

create index if not exists idx_orders_customer_phone_created_at_desc
  on public.orders (customer_phone, created_at desc);

create index if not exists idx_orders_payment_status_created_at_desc
  on public.orders (payment_status, created_at desc);

create index if not exists idx_orders_order_number
  on public.orders (order_number);

create index if not exists idx_customers_created_at_desc
  on public.customers (created_at desc);

create index if not exists idx_customers_phone
  on public.customers (phone);

create index if not exists idx_customers_email
  on public.customers (email);

create index if not exists idx_customers_active_created_at_desc
  on public.customers (active, created_at desc);

create index if not exists idx_products_active_sort_order
  on public.products (active, sort_order);

create index if not exists idx_products_category_active_sort_order
  on public.products (category_id, active, sort_order);

create index if not exists idx_products_subcategory_active_sort_order
  on public.products (subcategory_id, active, sort_order);

create index if not exists idx_products_featured_active_sort_order
  on public.products (featured, active, sort_order);

create index if not exists idx_products_created_at_desc
  on public.products (created_at desc);

-- Add uniqueness only when current data is already clean, so deploying this migration
-- never breaks a live project that has old duplicate rows.
do $$
begin
  if not exists (
    select 1
    from public.orders
    where order_number is not null and btrim(order_number::text) <> ''
    group by order_number
    having count(*) > 1
  ) then
    create unique index if not exists idx_orders_order_number_unique
      on public.orders (order_number)
      where order_number is not null and btrim(order_number::text) <> '';
  else
    raise notice 'Skipped unique index on orders.order_number because duplicates exist.';
  end if;

  if not exists (
    select 1
    from public.customers
    where phone is not null and btrim(phone::text) <> ''
    group by phone
    having count(*) > 1
  ) then
    create unique index if not exists idx_customers_phone_unique
      on public.customers (phone)
      where phone is not null and btrim(phone::text) <> '';
  else
    raise notice 'Skipped unique index on customers.phone because duplicates exist.';
  end if;
end $$;

do $$
begin
  if to_regclass('public.abandoned_carts') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'abandoned_carts_cart_count_non_negative'
    ) then
      alter table public.abandoned_carts
        add constraint abandoned_carts_cart_count_non_negative
        check (cart_count is null or cart_count >= 0) not valid;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'abandoned_carts_send_attempts_non_negative'
    ) then
      alter table public.abandoned_carts
        add constraint abandoned_carts_send_attempts_non_negative
        check (send_attempts is null or send_attempts >= 0) not valid;
    end if;
  end if;
end $$;
