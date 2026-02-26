# Postgres Migration Runbook

Use this for first-time setup, cutover, or restore.

## Target State

- Primary runtime source: managed Postgres event store
- Fallback source: local CSV (`data/events.csv`) in remote mode if store read fails
- Google Sheets: admin backup preview/import only

## Required Env

- `DATABASE_URL`
- `AUTH_SECRET`
- `DATA_MODE=remote`
- `ADMIN_KEY` (if admin auth is enabled)

Optional:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `REMOTE_CSV_URL`

## Cutover Steps

1. Create/connect Postgres and set `DATABASE_URL`
2. Open `/admin`
3. Load data with `Upload CSV to Postgres` or `Import Google Backup`
4. Run `Backup Now`
5. Review and save in `Event Sheet Editor`
6. `Save and Revalidate Homepage`
7. Verify source/status in admin runtime cards

## CLI Bootstrap (Optional)

```bash
DATABASE_URL=... pnpm bootstrap:postgres-store
```

## Backups

- Manual: `Backup Now` in admin
- Scheduled: `GET /api/cron/backup-event-store`
- Default schedule: daily at 04:20 UTC
- Retention: latest 30 snapshots

## Rollback

Fastest fallback:

1. Restore latest/selected snapshot in admin
2. Revalidate homepage

Emergency-only fallback:

- Set `DATA_MODE=local` to force local CSV runtime
