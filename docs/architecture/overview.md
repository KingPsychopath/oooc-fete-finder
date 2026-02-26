# Architecture Overview

This app is a Next.js App Router project for discovering Fete events, with a server-authenticated admin surface and a Postgres-backed data/store layer.

## System At A Glance

- Public pages are static-first and optimized for fast delivery
- Admin pages and admin APIs are server-authenticated
- Runtime event reads use a source chain controlled by `DATA_MODE`
- Featured events are managed by a dedicated Postgres scheduler

## Rendering Contract

1. Public routes are static-first (`/`, `/feature-event`, etc.)
2. Admin routes (`/admin`) are dynamic and authenticated
3. `app/layout.tsx` stays cache-friendly and should not depend on request cookies

## Auth Contract

- Public user session: `oooc_user_session`, managed through auth context
- Admin session: server-validated and required for admin routes/actions/APIs
- Header/UI auth hints should come from centralized session state, not repeated component-level fetches

## Data Contract

Runtime event reads flow through:

1. `features/data-management/runtime-service.ts#getLiveEvents()`
2. `features/data-management/data-manager.ts#getEventsData()`
3. Source order based on mode:
- `DATA_MODE=remote`: managed store first, then local CSV fallback
- `DATA_MODE=local`: local CSV only
- `DATA_MODE=test`: test fixture data

Notes:

- There is no custom runtime app cache layer for events
- Featured projection is applied after base event load
- Coordinate storage is KV-backed and warmed during admin writes

## Canonical Stores

- Event store tables:
- `app_event_store_columns`
- `app_event_store_rows`
- `app_event_store_meta`
- `app_event_store_settings`
- Featured schedule table:
- `app_featured_event_schedule`
- KV/app state tables:
- `app_kv_store`
- `app_event_submissions`
- `app_rate_limit_counters`

## Code Map

- `app/` routes and route handlers
- `features/data-management/` runtime data orchestration + admin write actions
- `features/events/` event domain logic and UI
- `features/events/featured/` scheduler actions and projection logic
- `features/security/` rate limiting and anti-abuse primitives
- `lib/platform/` logging, KV providers, Postgres adapters

## Related Docs

- [Event Identity](./event-identity.md)
- [Serverless Hardening](../operations/serverless-hardening.md)
- [Environment Variables](../reference/environment-variables.md)
