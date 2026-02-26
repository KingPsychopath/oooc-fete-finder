# Docs Home

If you are new to this codebase, start here.

## Fast Start (15 minutes)

1. Read [Architecture Overview](./architecture/overview.md)
2. Set env vars from [Environment Variables](./reference/environment-variables.md)
3. Run `pnpm install` then `pnpm dev`
4. Learn the admin publish flow in [Admin Workflow](./operations/admin-workflow.md)

## Choose by Goal

- I need the big picture: [Architecture Overview](./architecture/overview.md)
- I need stable event links: [Event Identity](./architecture/event-identity.md)
- I need to run/admin the app: [Admin Workflow](./operations/admin-workflow.md)
- I need deploy/runtime guardrails: [Serverless Hardening](./operations/serverless-hardening.md)
- I need Postgres cutover or recovery steps: [Postgres Migration](./operations/postgres-migration.md)
- I need logs/troubleshooting context: [Logging & Observability](./operations/logging-and-observability.md)
- I need abuse protection details: [Rate Limiting](./security/rate-limiting.md)
- I need Google integration behavior: [Google Integrations](./integrations/google.md)
- I need geocoding behavior: [Geocoding](./integrations/geocoding.md)
- I need all env vars and requirements: [Environment Variables](./reference/environment-variables.md)
- I need endpoint inventory: [API Endpoints](./reference/api-endpoints.md)

## Docs Structure

- `architecture/` system contracts and design decisions
- `operations/` day-to-day runbooks for admin/deploy/maintenance
- `security/` threat controls and endpoint protections
- `integrations/` external provider behavior (Google APIs)
- `reference/` env vars and endpoint inventories

## Source of Truth Rule

When docs and code disagree, code wins. Update docs in the same PR as behavior changes.
