# Docs Home

If you are new to this codebase, start here.

## Fast Start (15 minutes)

1. Read [Architecture Overview](./architecture/overview.md)
2. Read [Engagement Tracking](./architecture/engagement-tracking.md)
3. Set env vars from [Environment Variables](./reference/environment-variables.md)
4. Run `pnpm install` then `pnpm dev`
5. Learn the admin flow in [Admin Workflow](./operations/admin-workflow.md)

## Choose by Goal

- I need the big picture: [Architecture Overview](./architecture/overview.md)
- I need the tracking and "saved this" behavior: [Engagement Tracking](./architecture/engagement-tracking.md)
- I need stable event links: [Event Identity](./architecture/event-identity.md)
- I need to run/admin the app: [Admin Workflow](./operations/admin-workflow.md)
- I need deploy/runtime guardrails: [Serverless Hardening](./operations/serverless-hardening.md)
- I need Postgres cutover or recovery steps: [Postgres Migration](./operations/postgres-migration.md)
- I need logs/troubleshooting context: [Logging & Observability](./operations/logging-and-observability.md)
- I need abuse protection details: [Rate Limiting](./security/rate-limiting.md)
- I need endpoint inventory: [API Endpoints](./reference/api-endpoints.md)
- I need all env vars and requirements: [Environment Variables](./reference/environment-variables.md)
- I need Google integration behavior: [Google Integrations](./integrations/google.md)
- I need geocoding behavior: [Geocoding](./integrations/geocoding.md)

## Docs Structure

- `architecture/` system contracts and data/analytics design
- `operations/` runbooks for admin workflows, deploy, and recovery
- `security/` abuse controls and endpoint hardening
- `integrations/` external provider behavior (Google)
- `reference/` endpoint and environment references

## Source of Truth Rule

When docs and code disagree, code wins. Update docs in the same PR as behavior changes.
