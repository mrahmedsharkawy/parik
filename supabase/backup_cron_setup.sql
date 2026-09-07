-- Run these statements once from the Supabase SQL Editor after deploying
-- backup-control and setting BACKUP_CRON_SECRET in Edge Function secrets.
-- Replace the placeholder with the SAME strong random secret.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'REPLACE_WITH_THE_SAME_BACKUP_CRON_SECRET',
  'bariq_backup_cron_secret',
  'Authenticates the hourly Bariq backup scheduler'
);

select cron.schedule(
  'bariq-automatic-backup-hourly',
  '5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://knleehjjejfeobcmpwnw.supabase.co/functions/v1/backup-control',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'bariq_backup_cron_secret' limit 1
      )
    ),
    body := '{"action":"automatic"}'::jsonb
  );
  $cron$
);

