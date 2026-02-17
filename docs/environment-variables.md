# Environment Variables Reference

Schema lives in `lib/config/env.ts`. Cache defaults live in code (`lib/cache/cache-defaults.ts`); only optional overrides are documented below.

## Server Variables (app actually reads these)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `ADMIN_KEY` | **Yes** | - | Admin auth key |
| `AUTH_SECRET` | No | - | JWT/cookie signing |
| `DATABASE_URL` | No | - | Postgres connection (app uses only this for DB) |
| `DATA_MODE` | No | `remote` | `remote` \| `local` \| `test` |
| `REMOTE_CSV_URL` | No | - | CSV URL for admin backup preview/import |
| `GOOGLE_MAPS_API_KEY` | No | - | Geocoding; if unset, arrondissement centre fallback |
| `GOOGLE_SHEET_ID` | No | - | Backup sheet for admin import |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | - | **Preferred.** Full service account JSON (use on Vercel/remote). |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | No | - | Optional: path to JSON key file (e.g. `scripts/service-account.json`) for local dev only. |
| `LOCAL_CSV_LAST_UPDATED` | No | - | Metadata only (e.g. last CSV sync time) |
| `DEFAULT_OG_IMAGE` | No | - | OG image URL override |

## Optional cache overrides (read by `lib/cache/cache-defaults.ts`)

All other cache behaviour (memory limits, thresholds, retries, logging) is fixed in code.

| Variable | Default | Notes |
| --- | --- | --- |
| `CACHE_DURATION_MS` | `3600000` (1h) | In-memory cache TTL |
| `REMOTE_REFRESH_INTERVAL_MS` | `1800000` (30m) | How often to re-check remote/store |

## Client Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | `` | Subpath deployment |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical origin |

## Postgres

The app uses **only** `DATABASE_URL`. Variables like `PGHOST`, `PGUSER`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, etc. are often set by Vercel/Neon for convenience; the app does not read them. You only need `DATABASE_URL` for the app to use Postgres.

## Recommended setup (Postgres primary)

1. Set `DATA_MODE=remote` and `DATABASE_URL` (e.g. Neon pooler URL).
2. Use Google vars only for admin backup preview/import and geocoding.
3. Leave cache vars unset unless you need to tune TTL/refresh.
