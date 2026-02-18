# Serverless Hardening (Vercel)

This runbook documents the production/preview runtime rules for this app.

## Runtime Policy (Preview + Production)

1. KV provider is **strict Postgres-only**.
2. No fallback to file/memory KV in deployed serverless runtimes.
3. Google service account credentials are **env-only**:
   - Required: `GOOGLE_SERVICE_ACCOUNT_KEY`
4. Runtime disk persistence is not used for OG uploads or coordinate storage.

## Data Flow (Events + Coordinates)

1. Live reads remain pass-through (`runtime-service` -> `DataManager`).
2. Coordinate lookup storage is now KV-backed (`maps:locations:v1`), which is durable in production when Postgres KV is healthy.
3. Admin write actions warm coordinates once after write:
   - `saveLocalEventStoreCsv`
   - `importRemoteCsvToLocalEventStore`
   - `saveEventSheetEditorRows` (when homepage revalidation is enabled)
4. Warm-up failure is surfaced, but saved event-store data is still persisted.
5. Warm-up prunes location-cache keys not present in the latest dataset.
6. Stored `estimated` entries are auto-upgraded to `geocoded` when geocoding recovers.

## OG Image Strategy

1. Standardized OG variants:
   - `default` (site-wide default image)
   - `event-modal` (share links that include `?event=...`)
2. No runtime OG asset upload endpoint is used; OG images are generated dynamically.

## Troubleshooting

### KV strict-mode init failure

Symptoms:
- Startup/runtime errors from `kv-store-factory` in preview/production

Verify:
1. `DATABASE_URL` is set in Vercel `Preview` and `Production` envs.
2. Postgres integration is reachable from the deployment.
3. Runtime is Node.js (not Edge) for KV-dependent routes/actions.

### Coordinate warm-up failure/retry

Symptoms:
- Admin save/import returns failure after write with warm-up error

Verify:
1. `GOOGLE_MAPS_API_KEY` is present if geocoding is expected.
2. Geocoding API is enabled in Google Cloud Console.
3. Retry by running the same admin write action again after fixing configuration.
