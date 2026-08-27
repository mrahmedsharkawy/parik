create table if not exists public.app_settings (
  key text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null default auth.uid()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_admin_select on public.app_settings;
create policy app_settings_admin_select on public.app_settings for select to authenticated using (exists(select 1 from public.admins a where a.user_id=auth.uid() and coalesce(a.active,true)=true));
drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings for insert to authenticated with check (exists(select 1 from public.admins a where a.user_id=auth.uid() and coalesce(a.active,true)=true));
drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings for update to authenticated using (exists(select 1 from public.admins a where a.user_id=auth.uid() and coalesce(a.active,true)=true)) with check (exists(select 1 from public.admins a where a.user_id=auth.uid() and coalesce(a.active,true)=true));
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select to anon, authenticated using (key='main');
insert into public.app_settings(key,config) values('main','{"latest_version":"0.1.0","minimum_version":"0.1.0","android_build":1,"ios_build":1,"force_update":false,"maintenance_mode":false,"features":{"favorites":true,"cart":true,"reviews":true,"cashback":true,"offers":true,"image_search":false,"product_preview":false,"video":true,"occasions":true,"whatsapp":true},"home":{"page_size":24,"search_page_size":24,"smart_preload":true,"app_banners_enabled":true},"push":{"notification_inbox":true,"order_updates":true,"offers":true}}'::jsonb) on conflict(key) do nothing;
