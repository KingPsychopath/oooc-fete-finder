# Environment Variables

Validation schema: `lib/config/env.ts`

## Server Variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `AUTH_SECRET` | Yes | - | Minimum 32 chars; used for JWT/cookies and hashed security keys |
| `ADMIN_KEY` | No | `""` | If empty, admin auth is disabled |
| `ADMIN_RESET_PASSCODE` | No | - | Optional admin reset passcode |
| `ADMIN_NOTIFICATION_CACHE_SECONDS` | No | `15` | Admin top-nav badge cache TTL in seconds (`0` disables) |
| `DATABASE_URL` | No | - | Postgres connection string |
| `POSTGRES_POOL_MAX` | No | - | Optional pool tuning |
| `DATA_MODE` | Prod on Vercel: Yes | `remote` | `remote`, `local`, or `test` |
| `REMOTE_CSV_URL` | No | - | Optional backup CSV source for admin import/preview |
| `GOOGLE_SHEET_ID` | No | - | Optional Google Sheet backup source |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | - | Required for service-account sheet access |
| `GOOGLE_MAPS_API_KEY` | No | - | Enables address geocoding |
| `CRON_SECRET` | No | - | Protects cron endpoints |
| `DEPLOY_REVALIDATE_SECRET` | No | - | Protects deploy revalidation endpoint |

## Client Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | `""` | Optional subpath deploy |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical site origin |

## Production Notes

- In Vercel `preview`/`production`, missing `DATA_MODE` triggers startup failure
- For Postgres-backed runtime behavior, set `DATABASE_URL` and `DATA_MODE=remote`

## Secret Generation

```bash
openssl rand -base64 48  # AUTH_SECRET / CRON_SECRET / DEPLOY_REVALIDATE_SECRET
openssl rand -hex 24     # ADMIN_KEY
```
