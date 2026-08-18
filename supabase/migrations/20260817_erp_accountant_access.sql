-- Bariq ERP role-based access: owner + accountant
create table if not exists public.erp_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'accountant' check (role in ('owner','accountant','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.erp_users(user_id,full_name,role,active)
select a.user_id,coalesce(a.full_name,a.email,'Owner'),'owner',coalesce(a.active,true)
from public.admins a
where a.user_id is not null
on conflict (user_id) do update set full_name=excluded.full_name, role='owner', active=excluded.active, updated_at=now();

alter table public.erp_users enable row level security;
drop policy if exists "erp_users self select" on public.erp_users;
create policy "erp_users self select" on public.erp_users for select to authenticated using (user_id=auth.uid());

create or replace function public.erp_has_access() returns boolean
language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.erp_users u where u.user_id=auth.uid() and u.active=true and u.role in ('owner','accountant','admin'));
$$;
revoke all on function public.erp_has_access() from public;
grant execute on function public.erp_has_access() to authenticated;

do $$
declare r record; old_policy text; new_policy text;
begin
  for r in
    select c.relname as table_name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'erp_%' and c.relname <> 'erp_users'
  loop
    execute format('alter table public.%I enable row level security',r.table_name);
    old_policy := r.table_name || ' authenticated manage';
    execute format('drop policy if exists %I on public.%I',old_policy,r.table_name);
    new_policy := r.table_name || ' erp role manage';
    execute format('drop policy if exists %I on public.%I',new_policy,r.table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.erp_has_access()) with check (public.erp_has_access())',new_policy,r.table_name);
    execute format('revoke all on public.%I from anon',r.table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated',r.table_name);
  end loop;
end $$;

-- Views used by ERP remain readable only by authenticated users; underlying RLS still applies where applicable.
do $$
declare r record; begin
  for r in select table_name from information_schema.views where table_schema='public' and table_name like 'erp_%' loop
    execute format('revoke all on public.%I from anon',r.table_name);
    execute format('grant select on public.%I to authenticated',r.table_name);
  end loop;
end $$;

-- To activate an accountant after creating the user in Supabase Auth:
-- insert into public.erp_users(user_id,full_name,role,active) values ('ACCOUNTANT_AUTH_UUID','اسم المحاسب','accountant',true);
