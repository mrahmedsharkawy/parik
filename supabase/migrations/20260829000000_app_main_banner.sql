-- Dynamic Bariq app assets, managed by authenticated active admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-assets',
  'app-assets',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads Bariq app assets" on storage.objects;
create policy "Public reads Bariq app assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'app-assets');

drop policy if exists "Active admins upload Bariq app assets" on storage.objects;
create policy "Active admins upload Bariq app assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'app-assets'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and coalesce(a.active, true) = true
  )
);

drop policy if exists "Active admins update Bariq app assets" on storage.objects;
create policy "Active admins update Bariq app assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'app-assets'
  and exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and coalesce(a.active, true) = true
  )
)
with check (
  bucket_id = 'app-assets'
  and (storage.foldername(name))[1] = 'banners'
  and exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and coalesce(a.active, true) = true
  )
);

drop policy if exists "Active admins delete Bariq app assets" on storage.objects;
create policy "Active admins delete Bariq app assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'app-assets'
  and exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid()) and coalesce(a.active, true) = true
  )
);

grant select on table public.app_settings to anon, authenticated;
grant insert, update on table public.app_settings to authenticated;

update public.app_settings
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'home',
  coalesce(config -> 'home', '{}'::jsonb) || jsonb_build_object(
    'page_size', coalesce(config #> '{home,page_size}', '20'::jsonb),
    'search_page_size', coalesce(config #> '{home,search_page_size}', '20'::jsonb),
    'main_banner', coalesce(
      config #> '{home,main_banner}',
      '{"enabled":true,"ar":{"items":[]},"en":{"items":[]},"updated_at":""}'::jsonb
    )
  )
), updated_at = now()
where key = 'main';
