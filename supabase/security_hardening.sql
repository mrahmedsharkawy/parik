-- Security hardening for storefront tables.
-- Run manually in Supabase SQL Editor after confirming the storefront flows in staging.
-- This file is intentionally not executed by the static site.

-- 1) Public storefront settings: visitors may read, only active admins may write.
alter table if exists public.settings enable row level security;

drop policy if exists "Settings are readable by storefront" on public.settings;
drop policy if exists "Only active admins can insert settings" on public.settings;
drop policy if exists "Only active admins can update settings" on public.settings;
drop policy if exists "Only active admins can delete settings" on public.settings;

create policy "Settings are readable by storefront"
on public.settings
for select
to anon, authenticated
using (true);

create policy "Only active admins can insert settings"
on public.settings
for insert
to authenticated
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

create policy "Only active admins can update settings"
on public.settings
for update
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

create policy "Only active admins can delete settings"
on public.settings
for delete
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

-- 2) Customers: storefront may create rows, but public read/update is removed.
-- Admin pages keep full access through authenticated active admin accounts.
alter table if exists public.customers enable row level security;

drop policy if exists "Customers can be created from storefront" on public.customers;
drop policy if exists "Customers can be read for login and account sync" on public.customers;
drop policy if exists "Customers can update their storefront row" on public.customers;
drop policy if exists "Active admins can manage customers" on public.customers;
drop policy if exists "Authenticated users can read own customer row" on public.customers;
drop policy if exists "Authenticated users can update own customer row" on public.customers;

create policy "Customers can be created from storefront"
on public.customers
for insert
to anon, authenticated
with check (true);

create policy "Active admins can manage customers"
on public.customers
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

create policy "Authenticated users can read own customer row"
on public.customers
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy "Authenticated users can update own customer row"
on public.customers
for update
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'))
with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- 3) Push subscriptions: allow subscription writes, prevent public reading the list.
alter table if exists public.push_subscriptions enable row level security;

drop policy if exists "Anyone can subscribe" on public.push_subscriptions;
drop policy if exists "Anyone can update own subscription" on public.push_subscriptions;
drop policy if exists "Anyone can read count" on public.push_subscriptions;
drop policy if exists "Service role can delete" on public.push_subscriptions;
drop policy if exists "Active admins can read push subscriptions" on public.push_subscriptions;

create policy "Anyone can subscribe"
on public.push_subscriptions
for insert
to anon, authenticated
with check (true);

create policy "Active admins can read push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

-- Deletes are performed by Edge Functions using the service role key, which bypasses RLS.

-- 4) Abandoned carts: storefront can create queue rows; updates are performed by the Edge Function using the service role.
alter table if exists public.abandoned_carts enable row level security;

drop policy if exists "Anyone can upsert own abandoned cart" on public.abandoned_carts;
drop policy if exists "Anyone can update own abandoned cart" on public.abandoned_carts;
drop policy if exists "Service role can read abandoned carts" on public.abandoned_carts;
drop policy if exists "Service role can update abandoned carts" on public.abandoned_carts;

create policy "Anyone can create abandoned cart reminder"
on public.abandoned_carts
for insert
to anon, authenticated
with check (true);

-- 5) Orders: active admins can read/update orders. Storefront order creation should remain covered
-- by the existing order insert policy already used by checkout.
alter table if exists public.orders enable row level security;

drop policy if exists "Active admins can manage orders" on public.orders;

create policy "Active admins can manage orders"
on public.orders
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);