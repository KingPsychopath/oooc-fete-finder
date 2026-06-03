# Production Readiness

Use this checklist before a production deploy, after high-risk admin changes, or
when investigating production behavior.

## Deployment Target

The app is Railway-oriented. Read-only Railway inspection is safe for production
issues: status, deploy/build/runtime/HTTP logs, domains, and environment-variable
presence checks. Ask before paid, destructive, secret-revealing, or
infrastructure-changing actions.

## Runtime Policy

- Production and preview runtime data should be Postgres-backed.
- `DATABASE_URL` must be present and healthy when `DATA_MODE=remote`.
- Runtime disk persistence is not relied on for event, coordinate, admin,
  analytics, plan, saved-event, submission, or rate-limit state.
- Cron routes and deploy revalidation routes must be token-protected.
- Admin routes and admin APIs must stay server-authenticated and dynamic.

## Required Production Env

Set and verify:

- `NODE_ENV=production`
- `DATA_MODE=remote`
- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_KEY` if admin access should be enabled
- `ADMIN_RESET_PASSCODE` if factory reset should be available
- `CRON_SECRET` for cron services
- `DEPLOY_REVALIDATE_SECRET` for deploy revalidation
- `NEXT_PUBLIC_SITE_URL` set to the production origin
- `NEXT_PUBLIC_DEPLOYMENT_ID` set to a commit SHA or unique deploy identifier

Optional but production-relevant:

- `GOOGLE_MAPS_API_KEY` for geocoding
- `EVENT_OCR_API_KEY` or `GEMINI_API_KEY` for admin OCR drafts
- `STRIPE_WEBHOOK_SECRET` and `STRIPE_PAYMENT_LINK_ID_*` for partner order ingestion
- `TICKET_EXCHANGE_BOT_SECRET` for ticket-exchange bot endpoints

The authoritative env list is [Environment Variables](../reference/environment-variables.md).

## Pre-Deploy Checks

Run the checks that match the change:

```bash
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

For route-size and public HTML regressions:

```bash
BASE_URL=http://localhost:3000 pnpm check:public-routes
```

For cron configuration drift:

```bash
pnpm check:railway-cron
```

## Deploy Verification

After deploy:

1. Check Railway deployment status and build logs.
2. Check runtime logs for env validation failures, database connection warnings,
   revalidation failures, and Postgres fallback warnings.
3. Confirm the production domain resolves to the new deployment.
4. Call or open public smoke routes:
   - `/`
   - `/event/<known-event-key>`
   - `/exchange`
   - `/plans`
   - `/feature-event`
   - `/submit-event`
5. Confirm admin access at `/admin`.
6. Confirm `/api/admin/health` with admin authorization.
7. Confirm `/api/admin/deployment-status` reports the expected deployment id.
8. Confirm the homepage/runtime data source is live Postgres in admin runtime cards.

## Cron Verification

Railway cron services should match `config/railway-cron-services.json`.

Expected cron endpoints:

- `/api/cron/cleanup-admin-sessions` at `0 4 * * *`
- `/api/cron/cleanup-rate-limits` at `10 4 * * *`
- `/api/cron/backup-event-store` at `20 4 * * *`
- `/api/cron/cleanup-dismissed-partner-reports` at `30 4 * * *`

All require `Authorization: Bearer <CRON_SECRET>`. Cron service commands should
use `node scripts/railway-cron-trigger.mjs` with `TARGET_URL` and `CRON_SECRET`.

## Admin Publish Flow

For event data or placement changes:

1. Save changes in `/admin/content` or `/admin/placements`.
2. Use `/admin/operations` to verify data-store status.
3. Run backup before risky changes and after important publish changes.
4. Trigger revalidation from the admin flow or deploy hook as appropriate.
5. Smoke-test the public route and one event detail route.

## Incident Triage

For production issues, inspect in this order:

1. Railway status and active deployment.
2. Runtime logs for env, Postgres, revalidation, and fallback warnings.
3. HTTP logs for status patterns and affected routes.
4. Domain configuration and TLS state.
5. Admin health and data-store status.
6. Recent admin activity and backup availability.

Prefer read-only checks first. Do not rotate secrets, alter domains, restart
services, change paid infrastructure, delete data, or run destructive admin
actions without explicit approval.

## Rollback And Recovery

Fast recovery options:

- Roll back to the previous Railway deployment if the build is bad.
- Restore the latest known-good event-store backup in `/admin/operations`.
- Re-run deploy revalidation after restore.
- As an emergency-only data fallback, set `DATA_MODE=local` to serve bundled CSV
  data. This does not exercise Postgres-backed admin state, analytics, plans,
  saved events, submissions, or rate limits.

After recovery, refresh the bundled fallback CSV from the managed store before
the next release:

```bash
pnpm db:pull-events-csv
```
