# OOOC Fete Finder

A Next.js app for discovering Fete de la Musique events, with an admin workflow built around a Postgres source of truth.

## Data Model

Runtime source order (`DATA_MODE=remote`):

1. Postgres event store (primary)
2. Local CSV fallback (`data/events.csv`) if Postgres data is unavailable

Google Sheets is not used as the live runtime source. It is only used in admin for backup preview/import.

Auth modal user submissions are stored in the managed user store (`app_kv_store`) first, with optional Google mirroring only when explicitly enabled.

## Postgres Schema (Events)

Event sheet data is stored in normalized tables:

- `app_event_store_columns`
- `app_event_store_rows`
- `app_event_store_meta`
- `app_event_store_settings`

Other app state (auth/session/user collection) remains in:

- `app_kv_store`

## Admin Workflow (`/admin`)

1. Load data into Postgres:
   - `Upload CSV to Postgres`, or
   - `Import Google Backup`
2. Edit in `Event Sheet Editor` (supports dynamic columns)
3. `Publish to live cache`
4. Verify live payload in `Live Site Snapshot`
5. Export CSV anytime from `Data Store Controls`

## Environment Setup

Copy `.env.example` and set at least:

```bash
ADMIN_KEY=change-me
AUTH_SECRET=change-me
DATABASE_URL=postgresql://...
DATA_MODE=remote
```

Optional Google backup import/preview and geocoding:

```bash
REMOTE_CSV_URL=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
GOOGLE_MAPS_API_KEY=   # optional; enable Geocoding API in Cloud Console for precise coords
```

Cache defaults (TTL, memory, etc.) live in code; optional overrides: `CACHE_DURATION_MS`, `REMOTE_REFRESH_INTERVAL_MS`. See `docs/environment-variables.md`.

## Logging

One-line startup banner (data mode, DB, geocoding). Runtime logs use `lib/platform/logger` (scope + message; no per-event or memory spam). See `docs/logging.md`.

## Documentation

- `docs/environment-variables.md` — env reference (app only uses `DATABASE_URL` for Postgres)
- `docs/logging.md` — logging and startup
- `docs/geocoding.md` — Geocoding API and arrondissement fallback
- `docs/postgres-migration.md` — Postgres migration
- `docs/google-integrations.md` — Google backup/import

## Development

```bash
pnpm install
pnpm dev
```

## Scripts

```bash
pnpm bootstrap:postgres-store   # seed Postgres event store
pnpm health:check               # verify db + admin health endpoints
pnpm db:cli                     # interactive db/status utility
pnpm lint
pnpm exec tsc --noEmit
```

## Key Admin Endpoints

- `GET /api/admin/health`
- `GET /api/admin/data-store/status`
- `GET /api/admin/postgres/kv`
- `GET /api/admin/tokens/sessions`

All admin endpoints require valid admin auth.

## Migration notes

- `docs/postgres-migration.md` — Postgres migration
- `docs/environment-variables.md` — env reference
- `docs/google-integrations.md` — Google backup/import
