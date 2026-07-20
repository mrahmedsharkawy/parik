alter table public.user_sync enable row level security;

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
    'name', coalesce(full_name, name, ''),
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