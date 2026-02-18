# OOOC Fete Finder

A Next.js app for discovering Fete de la Musique events, with an admin workflow built around a Postgres source of truth.

## Data Model

Runtime source order (`DATA_MODE=remote`):

1. Postgres event store (primary)
2. Local CSV fallback (`data/events.csv`) if Postgres data is unavailable

Google Sheets is not used as the live runtime source. It is only used in admin for backup preview/import.

Featured scheduling is Postgres-backed (`app_featured_event_schedule`) and managed from the dedicated admin Featured Events Manager (not from CSV free-text `Featured` values).

Auth modal user submissions are stored in the managed user store (`app_kv_store`) first, with optional Google mirroring only when explicitly enabled.

Host event submissions are stored in Postgres (`app_event_submissions`) and reviewed in `/admin` before publishing.

In Vercel preview/production, KV provider selection is strict Postgres-only (no file/memory fallback).

## Runtime Data Flow (Current)

There is no custom app cache layer for events. `lib/cache/*` has been removed.

Server-side event reads flow as:

1. `features/data-management/runtime-service.ts#getLiveEvents()`
2. `DataManager.getEventsData()`
3. Source chain in remote mode:
   - managed Postgres event store (`store`)
   - local CSV fallback (`data/events.csv`) if store is unavailable/invalid
4. `processCSVData()`:
   - event key hydration
   - quality checks
   - coordinate population (when enabled)
5. Coordinate storage is durable KV-backed (`maps:locations:v1`) and prewarmed on admin writes (`save/import/sheet save + revalidate`) to reduce live geocoding churn. Warm-up also prunes stale keys and auto-upgrades `estimated` entries when geocoding is available.
6. Public delivery uses Next.js built-ins (ISR/revalidate APIs where configured).

What did not become a data cache:

- Logger dedupe map in `logger.ts` (line 20) is only log suppression.
- Runtime metrics counters in `runtime-service.ts` (line 74) are telemetry only.

## Postgres Schema (Events)

Event sheet data is stored in normalized tables:

- `app_event_store_columns`
- `app_event_store_rows`
- `app_event_store_meta`
- `app_event_store_settings`

Other app state (auth/session/user collection) remains in:

- `app_kv_store`
- `app_event_submissions`

## Admin Workflow (`/admin`)

1. Load data into Postgres:
   - `Upload CSV to Postgres`, or
   - `Import Google Backup`
2. Edit in `Event Sheet Editor` (supports dynamic columns)
3. Create snapshots (events + featured schedule) from `Data Store Controls` (`Backup Now`)
4. Restore either `Latest Backup` or a selected recent snapshot (with confirmation)
5. Manage featuring in `Featured Events Manager` (queue + slots)
6. `Save and Revalidate Homepage`
7. Verify live payload in `Live Site Snapshot`
8. Export CSV anytime from `Data Store Controls`

### Featured Scheduling (Strict Cutover)

- `Featured` CSV/sheet column is legacy and non-canonical.
- Any non-empty legacy `Featured` values are rejected on save/import.
- Use `/admin` -> `Featured Events Manager` for:
1. `Feature now`
2. Scheduled starts (Paris timezone)
3. Cancel/reschedule queue entries

### Stable Share Links (`eventKey`)

- Each event has a canonical immutable key: `Event Key` (`evt_...`).
- Homepage event modal URLs use `/?event=<eventKey>&slug=<eventSlug>`.
- `event` is canonical; `slug` is decorative.
- In admin UI, `Event Key` is system-managed (read-only).
- CSV import/export keeps `Event Key`; if missing on import, it is generated and persisted.

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
GOOGLE_SERVICE_ACCOUNT_KEY=   # required for service-account sheet access
GOOGLE_MAPS_API_KEY=          # optional; enable Geocoding API in Cloud Console for precise coords
```

No custom in-memory events cache is used. Live reads are pass-through source reads (`Postgres -> local fallback` in remote mode), with Next.js built-ins (ISR/on-demand revalidation) for delivery where configured.

## Logging + Dedupe

One-line startup banner (data mode, DB, geocoding). Runtime logs use `lib/platform/logger` (scope + message; no per-event or memory spam). In development, identical `info` logs are deduped briefly to reduce spam. This dedupe affects logs only, not data reads. See `docs/logging.md`.

## OG Images

Sharing now uses two standardized OG image variants:

1. `default` (site-wide)
2. `event-modal` (when sharing links with `?event=...`)

Admin and other pages inherit the default OG style unless explicitly overridden.

## Abuse Protection

`POST /api/auth/verify` is protected by two layers:

1. Vercel WAF edge rule (first-pass filtering before serverless execution).
2. In-app Postgres atomic rate limiting (`60/min` per IP and `6/15min` per email+IP).

Blocked requests return `429` with `Retry-After` and `no-store` cache headers.
Sensitive identifiers are HMAC-hashed with `AUTH_SECRET` in limiter keys/log context.

`POST /api/event-submissions` is protected by in-app Postgres atomic rate limiting:

- `20 / 10 minutes` per IP (`event_submit_ip`)
- `5 / 60 minutes` per email+IP (`event_submit_email_ip`)
- `1 / 24 hours` per normalized event fingerprint (`event_submit_fingerprint`)

Submission spam heuristics (honeypot + minimum completion time) are persisted for moderation and return a generic success response.

## Documentation

- `docs/environment-variables.md` — env reference (app only uses `DATABASE_URL` for Postgres)
- `docs/serverless-hardening.md` — Vercel production/preview runtime rules and troubleshooting
- `docs/logging.md` — logging and startup
- `docs/security-rate-limiting.md` — auth verify abuse controls and runbook
- `docs/geocoding.md` — Geocoding API and arrondissement fallback
- `docs/postgres-migration.md` — Postgres migration
- `docs/google-integrations.md` — Google backup/import
- `docs/architecture.md` — rendering/auth/revalidation contract (public static-first + server-authenticated admin)
- `docs/event-identity.md` — stable event identity model, CSV/admin workflows, and share-link FAQ

## Development

```bash
pnpm install
pnpm dev
```

## Scripts

```bash
pnpm bootstrap:postgres-store   # seed Postgres event store
pnpm bootstrap:featured-schedule # migrate legacy Featured rows into scheduler queue
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

**Cron (scheduled):**

- `GET /api/cron/cleanup-admin-sessions` — removes admin session records that expired more than 7 days ago.
- `GET /api/cron/cleanup-rate-limits` — removes stale auth verify limiter counters (24h grace).
- `GET /api/cron/backup-event-store` — creates Postgres snapshots (event store + featured schedule) daily at 04:20 UTC (retention: latest 30).

All are secured with `CRON_SECRET` (Bearer token) and configured in `vercel.json`.

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
