# OOOC Fete Finder

A Next.js app for discovering Fete de la Musique events, with an admin workflow built around a Postgres source of truth.

## Data Model

Runtime source order (`DATA_MODE=remote`):

1. Postgres event store (primary)
2. Local CSV fallback (`data/events.csv`) if Postgres data is unavailable

Google Sheets is not used as the live runtime source. It is only used in admin for backup preview/import.

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

Optional Google backup import/preview envs:

```bash
REMOTE_CSV_URL=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_SERVICE_ACCOUNT_FILE=service-account.json
```

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

## Migration Notes

Detailed migration steps are in:

- `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/docs/postgres-migration.md`
- `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/docs/environment-variables.md`
