# Postgres Migration Runbook

This project now supports a provider-backed local store where Postgres can be the canonical source of truth for:

- Event CSV store data
- Collected user emails

Google integrations remain optional and can be disabled gradually.

## 1. Create Postgres on Vercel

1. In Vercel, open your project.
2. Go to `Storage` and create a Postgres integration (Neon/Supabase/Aurora via Marketplace).
3. Copy the generated connection string.
4. Add `DATABASE_URL` to your Vercel project environment variables (`Production`, `Preview`, and optionally `Development`).

## 2. Set Migration Environment Variables

Add/update these env vars:

```bash
# Storage provider
DATA_STORE_PROVIDER=postgres
DATABASE_URL=postgres://...

# Keep admin auth
ADMIN_KEY=your-admin-key

# Disable Google write mirroring (recommended for migration)
GOOGLE_MIRROR_WRITES=false

# Keep for fallback compatibility while migrating
REMOTE_CSV_URL=
GOOGLE_SHEETS_URL=
```

Notes:

- `DATA_STORE_PROVIDER=auto` works too, but `postgres` is stricter and explicit.
- If Postgres is unavailable, runtime falls back to file/memory store.

## 3. Seed Local Event Store from Current Data

Use the Admin panel:

1. Open `/admin`.
2. In `Data Store Controls`:
   - Click `Import Remote CSV` once (if your Google source is still available), or
   - Click `Load CSV`, paste/upload your CSV, then `Save CSV`.
3. Keep `DATA_MODE=remote` so runtime reads from store first.
4. Confirm cache source changes to `Store`.

Or run the bootstrap script:

```bash
DATABASE_URL=... pnpm run bootstrap:postgres-store
```

This seeds:

- `events-store:csv`
- `events-store:meta`
- `events-store:settings`
- `users:collection:v1` (empty payload)

All of these keys are stored in a single Postgres table: `app_kv_store`.

## 4. Disable Google Reads

Once store data is verified:

1. Remove/blank Google env vars:
   - `REMOTE_CSV_URL`
   - `GOOGLE_SHEETS_API_KEY`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `GOOGLE_SHEETS_URL`
2. Redeploy.

The app will continue using:

- Managed event store (Postgres-backed KV)
- Local CSV fallback if needed

## 5. Email Collection Migration

Email submissions now write to provider-backed store first (Postgres when configured). Google mirroring is optional.

Admin export remains available from `/admin` as CSV.

## 6. Recommended Cutover Order

1. Configure Postgres + `DATA_STORE_PROVIDER=postgres`
2. Import event CSV into local store
3. Keep `DATA_MODE=remote`
4. Verify frontend/admin behavior
5. Disable Google env vars

## 7. Rollback

If needed:

1. Set `DATA_STORE_PROVIDER=auto`
2. Re-enable `REMOTE_CSV_URL` and/or Google credentials
3. Redeploy
