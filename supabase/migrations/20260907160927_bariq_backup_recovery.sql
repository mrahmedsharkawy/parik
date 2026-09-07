-- Bariq Backup & Recovery control plane.
-- Backup payloads are stored in a private bucket and can only be manipulated
-- by the server-side backup-control Edge Function.

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_name text not null unique,
  backup_type text not null default 'manual' check (backup_type in ('manual','automatic','safety','monthly')),
  backup_scope text not null default 'application' check (backup_scope in ('application','database_dr','storage','full')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','verified','deleted')),
  provider text not null default 'supabase_private' check (provider in ('supabase_private','external_webhook','manual_download')),
  object_path text,
  manifest_path text,
  encrypted boolean not null default true,
  encryption_version text,
  checksum_sha256 text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  table_count integer not null default 0 check (table_count >= 0),
  record_count bigint not null default 0 check (record_count >= 0),
  storage_file_count bigint not null default 0 check (storage_file_count >= 0),
  table_counts jsonb not null default '{}'::jsonb,
  storage_counts jsonb not null default '{}'::jsonb,
  contents jsonb not null default '{}'::jsonb,
  app_version text,
  database_version text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  deleted_at timestamptz
);

create index if not exists backup_runs_created_at_idx on public.backup_runs(created_at desc);
create index if not exists backup_runs_status_idx on public.backup_runs(status, created_at desc);

create table if not exists public.backup_settings (
  id boolean primary key default true check (id),
  automatic_enabled boolean not null default false,
  daily_hour_utc smallint not null default 22 check (daily_hour_utc between 0 and 23),
  daily_retention integer not null default 30 check (daily_retention between 1 and 365),
  monthly_retention integer not null default 12 check (monthly_retention between 1 and 120),
  provider text not null default 'supabase_private' check (provider in ('supabase_private','external_webhook','manual_download')),
  include_auth boolean not null default true,
  include_storage_inventory boolean not null default true,
  require_safety_backup boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.backup_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.backup_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  backup_id uuid references public.backup_runs(id) on delete set null,
  outcome text not null check (outcome in ('requested','success','failed','denied')),
  ip_address inet,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backup_audit_created_idx on public.backup_audit_log(created_at desc);
create index if not exists backup_audit_backup_idx on public.backup_audit_log(backup_id, created_at desc);

alter table public.backup_runs enable row level security;
alter table public.backup_settings enable row level security;
alter table public.backup_audit_log enable row level security;

revoke all on public.backup_runs from anon, authenticated;
revoke all on public.backup_settings from anon, authenticated;
revoke all on public.backup_audit_log from anon, authenticated;

grant select on public.backup_runs to authenticated;
grant select on public.backup_settings to authenticated;
grant select on public.backup_audit_log to authenticated;

create policy "Owners read backup runs" on public.backup_runs
for select to authenticated
using (exists (
  select 1 from public.erp_users u
  where u.user_id = (select auth.uid()) and u.active = true and u.role = 'owner'
));

create policy "Owners read backup settings" on public.backup_settings
for select to authenticated
using (exists (
  select 1 from public.erp_users u
  where u.user_id = (select auth.uid()) and u.active = true and u.role = 'owner'
));

create policy "Owners read backup audit" on public.backup_audit_log
for select to authenticated
using (exists (
  select 1 from public.erp_users u
  where u.user_id = (select auth.uid()) and u.active = true and u.role = 'owner'
));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'bariq-backups',
  'bariq-backups',
  false,
  524288000,
  array['application/octet-stream','application/json','application/gzip']
)
on conflict(id) do update set public = false;

-- No storage.objects policy is intentionally added. Browser clients cannot
-- access backup artifacts; short-lived signed URLs are issued server-side only.
