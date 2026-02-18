# Postgres Migration Runbook

This project now treats Postgres as the primary event store.

Source model:
- Primary: Postgres event tables
- Fallback: local CSV (`data/events.csv`) when Postgres data is unavailable
- Google: admin backup preview/import only (not live runtime source)

## 1. Create Postgres on Vercel

1. In Vercel, open your project.
2. Go to `Storage` and create a Postgres integration.
3. Copy the generated connection string.
4. Add `DATABASE_URL` to `Production`, `Preview`, and optionally `Development` envs.

## 2. Set Migration Environment Variables

```bash
DATABASE_URL=postgres://...
DATA_MODE=remote
ADMIN_KEY=your-admin-key

# Optional backup import/preview source
REMOTE_CSV_URL=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
```

## 3. Seed Postgres Event Store

Use the admin panel:

1. Open `/admin`.
2. In `Data Store Controls`:
   - `Upload CSV to Postgres`, or
   - `Import Google Backup`.
3. Edit in `Event Sheet Editor`.
4. Click `Save and Revalidate Homepage`.
5. Confirm `Event Key` values exist in export (first save/import backfills missing keys).

Or run bootstrap:

```bash
DATABASE_URL=... pnpm run bootstrap:postgres-store
```

Postgres event tables used by the app:
- `app_event_store_columns`
- `app_event_store_rows`
- `app_event_store_meta`
- `app_event_store_settings`

`app_kv_store` is still used for auth/session and collected users.

## 4. Disable Google as Runtime Source

After verification, keep Google vars only if you still want backup preview/import in admin.

Runtime will continue using:
- Postgres store first (`DATA_MODE=remote`)
- Local CSV fallback if Postgres data is unavailable

## 5. Email Collection

Email/user records are stored in Postgres KV (`app_kv_store`) and can be exported from `/admin` as CSV.
Google Apps Script output is optional mirror-only behavior and can be removed later.

## 6. Recommended Cutover Order

1. Configure Postgres + `DATABASE_URL`
2. Import CSV into Postgres store
3. Keep `DATA_MODE=remote`
4. Verify live source in admin is `Postgres Store`
5. Keep Google only as backup preview/import (optional)
6. Run one admin save/import cycle after deploy so legacy rows persist generated `Event Key` values.

## 7. Rollback

If required, set `DATA_MODE=local` to force local CSV-only runtime.

## 8. Google Mirror Sunset

When you are ready to fully remove Google output, follow:

- `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/docs/google-integrations.md`
