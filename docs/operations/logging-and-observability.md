# Logging and Observability

## Logger Model

- Central logger: `lib/platform/logger.ts`
- Dev format: human-readable logs
- Production format: structured JSON logs

## What Is Logged

- Startup runtime mode and integration readiness
- Runtime read/revalidation errors
- Geocoding fallback warning when API is unavailable
- Auth verify limiter availability warnings

## Noise Controls

- Development `info` logs are briefly deduped to reduce repeated spam
- `warn` and `error` are never deduped
- Dedupe affects logs only, not runtime reads or behavior

## What Was Intentionally Removed

- Per-address geocoding failure spam
- Repetitive coordinate-skip logs
- Periodic memory dump spam

## Troubleshooting Pattern

1. Confirm env vars in [Environment Variables](../reference/environment-variables.md)
2. Check `DataManager` source and warnings from admin runtime status
3. Validate DB/KV health from `/api/admin/health`
4. Re-run publish flow from [Admin Workflow](./admin-workflow.md)
