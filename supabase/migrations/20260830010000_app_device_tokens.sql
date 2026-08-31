create table if not exists public.app_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  locale text not null default 'ar',
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_device_tokens_user_id_idx
  on public.app_device_tokens(user_id);
create index if not exists app_device_tokens_active_idx
  on public.app_device_tokens(active, last_seen_at desc);

alter table public.app_device_tokens enable row level security;

drop policy if exists "Customers read own device tokens" on public.app_device_tokens;
drop policy if exists "Customers insert own device tokens" on public.app_device_tokens;
drop policy if exists "Customers update own device tokens" on public.app_device_tokens;
drop policy if exists "Customers delete own device tokens" on public.app_device_tokens;

create policy "Customers read own device tokens"
on public.app_device_tokens for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Customers insert own device tokens"
on public.app_device_tokens for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Customers update own device tokens"
on public.app_device_tokens for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Customers delete own device tokens"
on public.app_device_tokens for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.app_device_tokens to authenticated;

