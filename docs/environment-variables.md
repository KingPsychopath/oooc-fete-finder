# Environment Variables Reference

Schema lives in `lib/config/env.ts`.

## Server Variables (app actually reads these)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `ADMIN_KEY` | No | `""` | Admin auth key. If unset/empty, admin authentication is disabled. |
| `AUTH_SECRET` | **Yes** | - | JWT/cookie signing secret (minimum 32 characters) |
| `DATABASE_URL` | No | - | Postgres connection (app uses only this for DB) |
| `DATA_MODE` | Dev/Test: No, Prod: **Yes** | `remote` | `remote` \| `local` \| `test`; production throws at startup if missing |
| `REMOTE_CSV_URL` | No | - | CSV URL for admin backup preview/import |
| `GOOGLE_MAPS_API_KEY` | No | - | Geocoding; if unset, arrondissement centre fallback |
| `GOOGLE_SHEET_ID` | No | - | Backup sheet for admin import |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | - | Required for service-account sheet access. |
| `DEFAULT_OG_IMAGE` | No | - | OG image URL override |
| `CRON_SECRET` | No | - | Secret for cron routes (e.g. cleanup admin sessions). Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. |
| `DEPLOY_REVALIDATE_SECRET` | No | - | Secret for `/api/revalidate/deploy` (post-deploy live reload + homepage revalidation). |

## Client Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | `` | Subpath deployment |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical origin |

## Postgres

The app uses **only** `DATABASE_URL`. Variables like `PGHOST`, `PGUSER`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, etc. are often set by Vercel/Neon for convenience; the app does not read them. You only need `DATABASE_URL` for the app to use Postgres.

## Auth Verify Rate Limiting

`POST /api/auth/verify` uses fixed in-app limits backed by Postgres:

- IP limit: `60 requests / 60 seconds`
- Email+IP limit: `6 requests / 15 minutes`
- Failure mode: fail-open if limiter storage is unavailable (warning logged)

No extra env vars are required. It relies on:

- `DATABASE_URL` for shared rate-limit counters
- `AUTH_SECRET` for HMAC hashing of identifiers
- `CRON_SECRET` for `/api/cron/cleanup-rate-limits`

## Recommended setup (Postgres primary)

1. Set `DATA_MODE=remote` and `DATABASE_URL` (e.g. Neon pooler URL).
2. Use Google vars only for admin backup preview/import and geocoding.
3. No custom runtime events cache env vars are required (event reads are direct source reads).
4. Log dedupe is code-level (dev-only) and has no env toggle.

## Serverless strictness (Vercel preview/production)

1. KV storage is strict Postgres-only (`DATABASE_URL` must be healthy).
2. `GOOGLE_SERVICE_ACCOUNT_KEY` must be used for service account sheet access.

## Secret generation

- `AUTH_SECRET`: `openssl rand -base64 48`
- `ADMIN_KEY`: `openssl rand -hex 24`
- `CRON_SECRET`: `openssl rand -base64 48`
- `DEPLOY_REVALIDATE_SECRET`: `openssl rand -base64 48`
