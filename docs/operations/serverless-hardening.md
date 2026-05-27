# Serverless Hardening

This runbook defines production and preview runtime rules.

## Runtime Policy

1. KV/runtime store in deployed serverless environments is Postgres-backed
2. `DATABASE_URL` must be healthy
3. Cron routes and deploy revalidation routes must be token-protected
4. Runtime disk persistence is not relied on for event or coordinate storage

## Event + Revalidation Flow

1. Live reads: `runtime-service` -> `DataManager`
2. Homepage publish uses save + revalidate path/tag behavior
3. Deploy hook endpoint: `POST /api/revalidate/deploy`
4. Deploy hook requires `DEPLOY_REVALIDATE_SECRET`

## Cron Endpoints

Configured as Railway production cron services. The repo-owned expected config is `config/railway-cron-services.json`, and the dashboard state is verified with:

```bash
pnpm check:railway-cron
```

- `GET /api/cron/cleanup-admin-sessions` at `0 4 * * *`
- `GET /api/cron/cleanup-rate-limits` at `10 4 * * *`
- `GET /api/cron/backup-event-store` at `20 4 * * *`
- `GET /api/cron/cleanup-dismissed-partner-reports` at `30 4 * * *`

All require: `Authorization: Bearer <CRON_SECRET>`

Each Railway cron service uses `node scripts/railway-cron-trigger.mjs` with a no-op build command and watch patterns limited to:

- `scripts/railway-cron-trigger.mjs`
- `package.json`
- `pnpm-lock.yaml`

## Failure Checks

If runtime errors appear in preview/prod:

1. Confirm `DATABASE_URL` exists in Preview and Production envs
2. Confirm `DATA_MODE` is explicitly set (`remote`, `local`, or `test`)
3. Confirm `CRON_SECRET` and `DEPLOY_REVALIDATE_SECRET` are set where needed
4. Verify route handlers are running in Node runtime where expected
