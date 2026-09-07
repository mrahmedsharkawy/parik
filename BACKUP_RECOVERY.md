# Bariq Backup & Recovery

The admin page at `/backup.html` creates an encrypted application snapshot. It
is intentionally separate from the PostgreSQL disaster-recovery copy.

## Coverage

- Application snapshot: all public Data API tables discovered at run time,
  Auth user metadata, Storage inventory, metadata, AES-256-GCM encryption and
  SHA-256 verification.
- DR copy: PostgreSQL schema/data plus the binary contents of `products`,
  `ai-models`, and `app-assets`, with a SHA-256 manifest.
- Not recoverable from the application snapshot alone: Auth password hashes,
  PostgreSQL internal objects, and Storage binary files.

## One-time server setup

1. Apply `supabase/migrations/20260907160927_bariq_backup_recovery.sql`.
2. Set strong independent Edge Function secrets:
   `BACKUP_ENCRYPTION_KEY` (32 random bytes, base64) and
   `BACKUP_CRON_SECRET` (at least 32 random bytes).
3. Deploy `backup-control`.
4. Put the same cron secret into `supabase/backup_cron_setup.sql`, run it once
   in SQL Editor, then remove the value from the local file/history.
5. Configure `BACKUP_PROVIDER_URL` and optionally `BACKUP_PROVIDER_TOKEN` for
   an independent encrypted remote mirror.

## Independent DR backup

Run from PowerShell and choose a destination outside this project, preferably
an encrypted company drive or NAS:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bariq-full-dr-backup.ps1 -Destination E:\BariqBackups
```

The script aborts on a failed database or Storage copy and only prints success
after writing a SHA-256 manifest.

## Restore drill

Never test a full restore on production. Create a separate Supabase recovery
project, restore schema before data, import Auth/Storage with official Supabase
procedures, then compare table counts, Storage file counts, manifest hashes,
foreign keys, sample orders/invoices, ERP balances, and application login. Log
the drill date and result. Repeat quarterly and after major schema changes.

