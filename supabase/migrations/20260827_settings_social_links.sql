alter table if exists public.settings add column if not exists instagram text;
alter table if exists public.settings add column if not exists facebook text;
alter table if exists public.settings add column if not exists tiktok text;
alter table if exists public.settings add column if not exists snapchat text;
alter table if exists public.settings add column if not exists youtube text;
alter table if exists public.settings add column if not exists twitter text;
alter table if exists public.settings add column if not exists pinterest text;

comment on column public.settings.instagram is 'Storefront Instagram profile URL shown in account social links.';
comment on column public.settings.facebook is 'Storefront Facebook profile URL shown in account social links.';
comment on column public.settings.tiktok is 'Storefront TikTok profile URL shown in account social links.';
comment on column public.settings.snapchat is 'Storefront Snapchat profile URL shown in account social links.';
comment on column public.settings.youtube is 'Storefront YouTube URL shown in account social links.';
comment on column public.settings.twitter is 'Storefront Twitter/X URL shown in account social links.';
comment on column public.settings.pinterest is 'Storefront Pinterest URL shown in account social links.';
