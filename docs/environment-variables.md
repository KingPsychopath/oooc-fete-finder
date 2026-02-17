# Environment Variables Reference

This file mirrors the typed schema in `lib/config/env.ts`.

## Server Variables

| Variable | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | `development \| production \| test` | No | `development` | Runtime mode |
| `ADMIN_KEY` | `string` | Yes | - | Admin auth key |
| `AUTH_SECRET` | `string` | No | - | Optional signing secret |
| `DATABASE_URL` | `string` | No | - | Required for Postgres-backed store |
| `DATA_STORE_PROVIDER` | `auto \| postgres` | No | `auto` | Store provider strategy |
| `DATA_MODE` | `remote \| local \| test` | No | `remote` | Data loading mode |
| `GOOGLE_MIRROR_WRITES` | `boolean` | No | `false` | Mirror writes to Google fallback |
| `REMOTE_CSV_URL` | `url \| empty` | No | - | Remote CSV fallback source |
| `GOOGLE_SHEETS_API_KEY` | `string` | No | - | Optional fallback auth |
| `GOOGLE_MAPS_API_KEY` | `string` | No | - | Geocoding support |
| `GOOGLE_SHEET_ID` | `string` | No | - | Remote sheet id |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `string` | No | - | Service account JSON string |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | `string` | No | `service-account.json` | Local service account file |
| `GOOGLE_SHEETS_URL` | `url \| empty` | No | - | Apps Script endpoint |
| `CACHE_DURATION_MS` | `number` | No | `3600000` | Fresh cache TTL |
| `REMOTE_REFRESH_INTERVAL_MS` | `number` | No | `1800000` | Remote check interval |
| `MAX_CACHE_AGE_MS` | `number` | No | `86400000` | Max stale age |
| `CACHE_EXTENSION_DURATION_MS` | `number` | No | `7200000` | Stale extension |
| `CACHE_MAX_MEMORY_BYTES` | `number` | No | `52428800` | Cache memory limit |
| `CACHE_MEMORY_CHECK_INTERVAL_MS` | `number` | No | `300000` | Memory check interval |
| `CACHE_CLEANUP_THRESHOLD` | `number` | No | `0.8` | Cleanup threshold |
| `CACHE_EMERGENCY_THRESHOLD` | `number` | No | `0.95` | Emergency threshold |
| `CACHE_MAX_METRICS_HISTORY` | `number` | No | `100` | Metrics samples |
| `CACHE_METRICS_RESET_INTERVAL_MS` | `number` | No | `86400000` | Metrics reset interval |
| `CACHE_DEDUPLICATION_TIMEOUT_MS` | `number` | No | `5000` | Request dedupe timeout |
| `CACHE_MAX_RETRY_ATTEMPTS` | `number` | No | `3` | Retry attempts |
| `CACHE_RETRY_BACKOFF_MS` | `number` | No | `1000` | Retry backoff |
| `CACHE_BOOTSTRAP_MODE` | `strict \| fallback \| graceful` | No | `graceful` | Failure strategy |
| `CACHE_VERBOSE_LOGGING` | `boolean` | No | `false` | Verbose logs |
| `CACHE_LOG_MEMORY_USAGE` | `boolean` | No | `true` | Memory logs |
| `CACHE_LOG_PERFORMANCE_METRICS` | `boolean` | No | `false` | Perf metrics logs |
| `LOCAL_CSV_LAST_UPDATED` | `string` | No | - | UI fallback metadata |
| `DEFAULT_OG_IMAGE` | `string` | No | - | OG image override |

## Client Variables

| Variable | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | `string` | No | `` | Subpath deployment |
| `NEXT_PUBLIC_SITE_URL` | `url` | No | `http://localhost:3000` | Canonical origin |

## Recommended Setup (Postgres Primary)

1. Set `DATA_STORE_PROVIDER=postgres`
2. Set `DATA_MODE=remote`
3. Set `DATABASE_URL` (Neon pooler URL)
4. Keep `REMOTE_CSV_URL` and Google vars only as fallback/migration inputs
5. Keep `GOOGLE_MIRROR_WRITES=false` unless you explicitly need mirror writes
