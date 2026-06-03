# OOOC Fête Finder

OOOC Fête Finder is a Next.js application for discovering Fête de la Musique events in Paris. It combines a public event finder with an authenticated admin workflow for managing event data, submissions, featured placements, partner activations, and engagement insights.

The project is maintained for Out Of Office Collective and is designed around a Postgres source of truth, static-first public pages, and dynamic authenticated admin operations.

## Highlights

- Event discovery with search, filters, maps, stable share links, and event detail modals
- Admin console for event sheet editing, host submissions, featured/promoted scheduling, runtime health, and recovery actions
- Postgres-backed event store with backup and bundled CSV fallback paths
- Engagement tracking for saved-event social proof, discovery analytics, partner reporting, and audience preferences
- Optional geocoding enrichment for map coordinates, with text-search fallbacks when provider keys are unavailable
- Abuse protection for auth, tracking, preference, and event-submission endpoints

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- Postgres
- Vitest
- Biome
- Railway-oriented deployment/runtime conventions

## Repository Status

This repository is source-available, not open-source licensed. The code is shared for transparency and review, but reuse, copying, modification, distribution, sublicensing, or sale is not permitted without prior written permission.

See [LICENSE](./LICENSE) for the full terms.

## Getting Started

### Prerequisites

- Node.js compatible with the current Next.js version
- pnpm
- A Postgres database for remote/runtime data workflows

### Install

```bash
pnpm install
```

### Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Set the required values:

```bash
AUTH_SECRET=replace-with-a-random-32-plus-character-secret
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
DATA_MODE=remote
```

`ADMIN_KEY` is optional. If it is empty, admin login and admin APIs are disabled.

Optional provider integrations, such as Google geocoding, event OCR, Stripe webhooks, and ticket-exchange bot auth, are documented in [.env.example](./.env.example) and [docs/reference/environment-variables.md](./docs/reference/environment-variables.md).

### Run Locally

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Seed Runtime Data

For a Postgres-backed setup, seed or migrate the event store before relying on `DATA_MODE=remote`:

```bash
pnpm bootstrap:postgres-store
```

For local development, prefer `DATA_MODE=remote` with a local or preview Postgres database. `DATA_MODE=local` is an emergency/no-database fallback path that reads only the bundled CSV. See [Local Data Workflow](./docs/operations/local-data-workflow.md).

Before release, refresh the bundled fallback snapshot from the managed store:

```bash
pnpm db:pull-events-csv
```

## Common Commands

```bash
pnpm dev                 # start the local dev server
pnpm build               # create a production build
pnpm start               # run the production build
pnpm test                # run Vitest
pnpm test:coverage       # run Vitest with coverage
pnpm lint                # run Biome linting
pnpm format              # format with Biome
pnpm fix                 # apply Biome fixes
pnpm deadcode            # scan unused files/dependencies with knip
pnpm deadcode:exports    # scan unused TypeScript exports
pnpm check:user-id-drift  # check canonical userId identity drift in analytics tables
pnpm health:check        # verify database and admin health endpoints
pnpm db:cli              # open the database/status utility
```

## Project Structure

```text
app/                       Next.js routes, layouts, route handlers, and page-level UI
features/data-management/  Runtime data orchestration and admin write workflows
features/events/           Event domain logic, filtering, ordering, cards, and tracking
features/events/featured/  Featured event scheduling
features/events/promoted/  Promoted event scheduling
features/locations/        Location resolution and map-link behavior
features/maps/             Coordinate storage, warmup, and map utilities
features/partners/         Partner activation and reporting workflows
features/security/         Rate limiting and abuse-prevention primitives
lib/platform/              Logging, KV adapters, Postgres clients, and repositories
docs/                      Architecture notes, runbooks, integration docs, and references
```

## Runtime Model

In `DATA_MODE=remote`, event reads use this source order:

1. Managed Postgres event store
2. Latest Postgres event-store backup if the live store is unavailable or invalid
3. Bundled local CSV fallback if remote reads and backups are unavailable

Public pages are static-first where possible. Admin routes and admin APIs are authenticated, dynamic, and request-time rendered.

See [docs/architecture/overview.md](./docs/architecture/overview.md) for the full rendering, auth, data, and code-map contract.

## Admin Workflow

The admin console is split into focused areas:

- `/admin` for the overview hub
- `/admin/operations` for runtime health, store controls, sessions, and recovery
- `/admin/content` for event editing, submissions moderation, and sliding banner settings
- `/admin/placements` for paid order queues and spotlight/promoted schedulers
- `/admin/insights` for engagement analytics and collected users

The standard publish loop is:

1. Edit event content in `/admin/content`
2. Manage featured or promoted placements in `/admin/placements`
3. Backup and revalidate in `/admin/operations`
4. Review tracking and audience outcomes in `/admin/insights`

See [docs/operations/admin-workflow.md](./docs/operations/admin-workflow.md) for the day-to-day runbook.

## Documentation

Start with [docs/README.md](./docs/README.md) for a guided index.

Key references:

- [Architecture Overview](./docs/architecture/overview.md)
- [Event Identity](./docs/architecture/event-identity.md)
- [Engagement Tracking](./docs/architecture/engagement-tracking.md)
- [Admin Workflow](./docs/operations/admin-workflow.md)
- [Production Readiness](./docs/operations/production-readiness.md)
- [Logging and Observability](./docs/operations/logging-and-observability.md)
- [Rate Limiting](./docs/security/rate-limiting.md)
- [API Endpoints](./docs/reference/api-endpoints.md)
- [Environment Variables](./docs/reference/environment-variables.md)
- [Location Resolution](./docs/integrations/geocoding.md)

## Quality Checks

Before merging meaningful changes, run the checks that match the change scope:

```bash
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

For cleanup or dependency work, also run:

```bash
pnpm deadcode
pnpm deadcode:exports
```

## Security Notes

- `AUTH_SECRET` must be at least 32 characters and should be generated with a secure random source.
- `ADMIN_KEY`, `ADMIN_RESET_PASSCODE`, `CRON_SECRET`, and `DEPLOY_REVALIDATE_SECRET` should be distinct values.
- Admin endpoints require valid admin authentication.
- Production and preview deploys should set `DATA_MODE=remote` and `DATABASE_URL`.
- Sensitive identifiers used for rate limiting are HMAC-hashed with `AUTH_SECRET`.

## Images

This README intentionally does not include screenshots. The project is primarily an operational web application, and the most useful context for new readers is the architecture, setup path, and admin workflow. Visual assets live in the app and docs where they support a specific feature or artifact.

## License

Copyright (c) 2026 Out Of Office Collective.

All rights reserved. This project is proprietary. See [LICENSE](./LICENSE).
