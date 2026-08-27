create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'push',
  icon text default '🔔',
  title text not null,
  msg text,
  body text,
  order_id text,
  user_id uuid references auth.users(id) on delete cascade,
  customer_email text,
  customer_phone text,
  url text,
  status text,
  order_status text,
  amount numeric(12,2),
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table if exists public.notifications add column if not exists body text;
alter table if exists public.notifications add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.notifications add column if not exists customer_email text;
alter table if exists public.notifications add column if not exists customer_phone text;
alter table if exists public.notifications add column if not exists url text;
alter table if exists public.notifications add column if not exists status text;
alter table if exists public.notifications add column if not exists order_status text;
alter table if exists public.notifications add column if not exists amount numeric(12,2);
alter table if exists public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
alter table if exists public.notifications add column if not exists read_at timestamptz;

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_customer_email_idx on public.notifications(lower(customer_email));
create index if not exists notifications_customer_phone_idx on public.notifications(customer_phone);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notifications_unread_idx on public.notifications(is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Customers read own notifications" on public.notifications;
drop policy if exists "Customers mark own notifications read" on public.notifications;
drop policy if exists "Active admins manage notifications" on public.notifications;

create policy "Customers read own notifications"
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or lower(coalesce(customer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  or exists (
    select 1
    from public.customers c
    where lower(coalesce(c.email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and coalesce(c.phone, '') <> ''
    and c.phone = notifications.customer_phone
  )
  or exists (
    select 1
    from public.orders o
    where (
      o.id::text = notifications.order_id
      or coalesce(o.order_number::text, '') = replace(coalesce(notifications.order_id, ''), '#', '')
    )
    and lower(coalesce(o.customer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  or (
    user_id is null
    and coalesce(customer_email, '') = ''
    and coalesce(customer_phone, '') = ''
    and coalesce(order_id, '') = ''
  )
);

create policy "Customers mark own notifications read"
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  or lower(coalesce(customer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  or exists (
    select 1
    from public.customers c
    where lower(coalesce(c.email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and coalesce(c.phone, '') <> ''
    and c.phone = notifications.customer_phone
  )
)
with check (
  user_id = (select auth.uid())
  or lower(coalesce(customer_email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  or exists (
    select 1
    from public.customers c
    where lower(coalesce(c.email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and coalesce(c.phone, '') <> ''
    and c.phone = notifications.customer_phone
  )
);

create policy "Active admins manage notifications"
on public.notifications
for all
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and coalesce(a.active, true) = true
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and coalesce(a.active, true) = true
  )
);

grant select on public.notifications to authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;
