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
3. `Save and Revalidate Homepage`
4. Verify live payload in `Live Site Snapshot`
5. Export CSV anytime from `Data Store Controls`

## Environment Setup

Copy `.env.example` and set at least:

```bash
AUTH_SECRET=replace-with-a-random-32-plus-character-secret
DATABASE_URL=postgresql://...
DATA_MODE=remote
```

`DATA_MODE` is required in production deploys. The app now fails fast at startup if it is missing in production.

`ADMIN_KEY` is optional for builds. If unset, admin login/admin APIs are disabled.

Optional Google backup import/preview and geocoding:

```bash
REMOTE_CSV_URL=
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=   # preferred (use on Vercel); or GOOGLE_SERVICE_ACCOUNT_FILE for local
GOOGLE_MAPS_API_KEY=          # optional; enable Geocoding API in Cloud Console for precise coords
```

No runtime in-memory events cache is used. Live reads come from runtime source (`Postgres -> local fallback` in remote mode), with ISR + on-demand revalidation for delivery.

## Logging

One-line startup banner (data mode, DB, geocoding). Runtime logs use `lib/platform/logger` (scope + message; no per-event or memory spam). See `docs/logging.md`.

## Documentation

- `docs/environment-variables.md` — env reference (app only uses `DATABASE_URL` for Postgres)
- `docs/logging.md` — logging and startup
- `docs/geocoding.md` — Geocoding API and arrondissement fallback
- `docs/postgres-migration.md` — Postgres migration
- `docs/google-integrations.md` — Google backup/import
- `docs/architecture.md` — rendering/auth/revalidation contract (public static-first + server-authenticated admin)

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
- `POST /api/revalidate/deploy` (or `GET`) with `Authorization: Bearer <DEPLOY_REVALIDATE_SECRET>` for post-deploy live reload + homepage revalidation

All admin endpoints require valid admin auth.

**Cron (scheduled):** `GET /api/cron/cleanup-admin-sessions` — removes admin session records that expired more than 7 days ago. Secured with `CRON_SECRET` (Bearer token). Configured in `vercel.json` to run daily at 04:00 UTC.

## Post-Deploy Revalidation Hook

Set `DEPLOY_REVALIDATE_SECRET`, then call:

```bash
curl -X POST "https://<your-domain>/api/revalidate/deploy" \
  -H "Authorization: Bearer $DEPLOY_REVALIDATE_SECRET"
```

This endpoint forces a live events reload and revalidates `/`, so preview/prod comes up with the right data immediately after deploy.

## Migration notes

- `docs/postgres-migration.md` — Postgres migration
- `docs/environment-variables.md` — env reference
- `docs/google-integrations.md` — Google backup/import

## Future Architecture Option

- Keep current static-first rendering for best ISR/cache performance.
- Optional future upgrade: dynamic auth island (partial prerendering boundary) so auth-dependent UI is request-correct on first paint while preserving static shell/cache for the rest of the page.
- Tradeoff: higher implementation/runtime complexity in exchange for eliminating auth bootstrap reconciliation on first paint.
