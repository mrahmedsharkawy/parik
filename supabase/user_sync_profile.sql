alter table public.user_sync enable row level security;

delete from public.user_sync a
using public.user_sync b
where a.ctid < b.ctid
  and a.user_email = b.user_email
  and a.data_type = b.data_type;

create unique index if not exists user_sync_email_type_uidx
on public.user_sync (user_email, data_type);

insert into public.customers (full_name, email, phone, active)
select
  split_part(lower(trim(ps.user_email)), '@', 1) as full_name,
  lower(trim(ps.user_email)) as email,
  ps.user_phone as phone,
  true as active
from public.push_subscriptions ps
where coalesce(trim(ps.user_email), '') <> ''
  and not exists (
    select 1
    from public.customers c
    where lower(trim(c.email)) = lower(trim(ps.user_email))
       or (coalesce(trim(ps.user_phone), '') <> '' and c.phone = ps.user_phone)
  );

drop policy if exists "Users can read own sync rows" on public.user_sync;
create policy "Users can read own sync rows"
on public.user_sync
for select
to authenticated
using (user_email = (auth.jwt() ->> 'email'));

drop policy if exists "Users can insert own sync rows" on public.user_sync;
create policy "Users can insert own sync rows"
on public.user_sync
for insert
to authenticated
with check (user_email = (auth.jwt() ->> 'email'));

drop policy if exists "Users can update own sync rows" on public.user_sync;
create policy "Users can update own sync rows"
on public.user_sync
for update
to authenticated
using (user_email = (auth.jwt() ->> 'email'))
with check (user_email = (auth.jwt() ->> 'email'));

insert into public.user_sync (user_email, data_type, data, updated_at)
select
  lower(trim(email)) as user_email,
  'profile' as data_type,
  jsonb_build_object(
    'name', coalesce(full_name, ''),
    'email', lower(trim(email)),
    'phone', coalesce(phone, ''),
    'address', coalesce(address, city, ''),
    'ts', extract(epoch from now()) * 1000
  ) as data,
  now() as updated_at
from public.customers c
where coalesce(trim(email), '') <> ''
  and not exists (
    select 1
    from public.user_sync s
    where s.user_email = lower(trim(c.email))
      and s.data_type = 'profile'
  );

create or replace function public.sync_customer_profile_to_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.email), '') = '' then
    return new;
  end if;

  insert into public.user_sync (user_email, data_type, data, updated_at)
  values (
    lower(trim(new.email)),
    'profile',
    jsonb_build_object(
      'name', coalesce(new.full_name, ''),
      'email', lower(trim(new.email)),
      'phone', coalesce(new.phone, ''),
      'address', coalesce(new.address::text, new.city, ''),
      'ts', extract(epoch from now()) * 1000
    ),
    now()
  )
  on conflict (user_email, data_type) do update set
    data = excluded.data,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists customers_profile_to_user_sync on public.customers;
create trigger customers_profile_to_user_sync
after insert or update of email, full_name, phone, address, city
on public.customers
for each row
execute function public.sync_customer_profile_to_user_sync();

create or replace function public.ensure_customer_from_push_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.user_email), '') = '' then
    return new;
  end if;

  insert into public.customers (full_name, email, phone, active)
  values (
    split_part(lower(trim(new.user_email)), '@', 1),
    lower(trim(new.user_email)),
    new.user_phone,
    true
  )
  on conflict (phone) do update set
    email = coalesce(excluded.email, public.customers.email),
    active = true;

  return new;
end;
$$;

drop trigger if exists push_subscription_to_customer on public.push_subscriptions;
create trigger push_subscription_to_customer
after insert or update of user_email, user_phone
on public.push_subscriptions
for each row
execute function public.ensure_customer_from_push_subscription();