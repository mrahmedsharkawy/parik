alter table public.user_sync enable row level security;

delete from public.user_sync s
using (
  select id,
    row_number() over (
      partition by lower(trim(user_email)), data_type
      order by updated_at desc nulls last, id desc
    ) as rn
  from public.user_sync
) ranked
where s.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists user_sync_email_type_uidx
on public.user_sync (user_email, data_type);

delete from public.user_sync s
where s.data_type = 'profile'
  and not exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(s.user_email))
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
  and exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(c.email))
  )
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

  if not exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(new.email))
  ) then
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

create or replace function public.prevent_duplicate_customer_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.email), '') <> '' and exists (
    select 1
    from public.customers c
    where lower(trim(c.email)) = lower(trim(new.email))
      and c.id is distinct from new.id
  ) then
    raise exception 'duplicate_email';
  end if;

  if coalesce(trim(new.phone), '') <> '' and exists (
    select 1
    from public.customers c
    where c.phone = new.phone
      and c.id is distinct from new.id
  ) then
    raise exception 'duplicate_phone';
  end if;

  return new;
end;
$$;

drop trigger if exists customers_prevent_duplicate_identity on public.customers;
create trigger customers_prevent_duplicate_identity
before insert or update of email, phone
on public.customers
for each row
execute function public.prevent_duplicate_customer_identity();

drop trigger if exists customers_profile_to_user_sync on public.customers;
create trigger customers_profile_to_user_sync
after insert or update of email, full_name, phone, address, city
on public.customers
for each row
execute function public.sync_customer_profile_to_user_sync();

drop trigger if exists push_subscription_to_customer on public.push_subscriptions;
drop function if exists public.ensure_customer_from_push_subscription();