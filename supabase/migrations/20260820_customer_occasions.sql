create table if not exists public.customer_occasions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id bigint null references public.customers(id) on delete set null,
  customer_email text null,
  customer_phone text null,
  occasion_name text not null,
  occasion_type text not null default 'other',
  person_name text not null,
  relationship text null,
  occasion_day int not null check (occasion_day between 1 and 31),
  occasion_month int not null check (occasion_month between 1 and 12),
  occasion_year int null check (occasion_year between 1900 and 2200),
  remind_before_days int not null default 7 check (remind_before_days in (1, 3, 7, 14, 30)),
  reminder_enabled boolean not null default true,
  last_reminder_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_occasions_user_id_idx
  on public.customer_occasions(user_id);

create index if not exists customer_occasions_customer_id_idx
  on public.customer_occasions(customer_id);

create index if not exists customer_occasions_reminder_scan_idx
  on public.customer_occasions(reminder_enabled, occasion_month, occasion_day)
  where reminder_enabled = true;

create or replace function public.set_customer_occasions_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_occasions_updated_at on public.customer_occasions;
create trigger customer_occasions_updated_at
before update on public.customer_occasions
for each row execute function public.set_customer_occasions_updated_at();

alter table public.customer_occasions enable row level security;

drop policy if exists "Customers manage own occasions" on public.customer_occasions;
drop policy if exists "Active admins read customer occasions" on public.customer_occasions;

create policy "Customers manage own occasions"
on public.customer_occasions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Active admins read customer occasions"
on public.customer_occasions
for select
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.active = true
      and (a.user_id = auth.uid() or lower(a.email) = lower(auth.jwt() ->> 'email'))
  )
);

grant select, insert, update, delete on public.customer_occasions to authenticated;

create or replace view public.customer_occasions_admin_stats
with (security_invoker = true)
as
select
  count(*)::int as total_occasions,
  count(*) filter (where reminder_enabled = true)::int as enabled_reminders,
  count(*) filter (where reminder_enabled = false)::int as disabled_reminders,
  count(*) filter (where last_reminder_sent_at >= now() - interval '30 days')::int as sent_last_30_days
from public.customer_occasions;

grant select on public.customer_occasions_admin_stats to authenticated;
