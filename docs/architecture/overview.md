# Architecture Overview

This app is a Next.js App Router project for Fete event discovery, with a server-authenticated admin console, Postgres-backed runtime data, and first-party engagement tracking.

## System At A Glance

- Public pages are static-first and optimized for fast delivery
- Admin pages and admin APIs are server-authenticated and module-based
- Runtime event reads use a source chain controlled by `DATA_MODE`
- Spotlight/Promoted scheduling is Postgres-backed
- Engagement tracking powers social proof, insights, and partner reporting

## Rendering Contract

1. Public routes are static-first (`/`, `/feature-event`, etc.)
2. Admin routes are dynamic and authenticated (`/admin/*`)
3. `app/layout.tsx` stays cache-friendly and should not depend on request cookies

## Admin Console Contract

Admin is split into focused surfaces:

- `/admin` overview hub
- `/admin/operations` system/runtime controls
- `/admin/content` event data, submissions, banner settings
- `/admin/placements` paid queue + spotlight/promoted scheduling
- `/admin/insights` analytics and audience tools

## Auth Contract

- Public user session: `oooc_user_session`, managed through auth context
- Admin session: server-validated and required for admin routes/actions/APIs
- Header/UI auth hints should come from centralized session state

## Data Contract

Runtime event reads flow through:

1. `features/data-management/runtime-service.ts#getLiveEvents()`
2. `features/data-management/data-manager.ts#getEventsData()`
3. Source order based on mode:
- `DATA_MODE=remote`: managed store first, then local CSV fallback
- `DATA_MODE=local`: local CSV only
- `DATA_MODE=test`: test fixture data

Projection behavior in runtime service:

- Featured and promoted projection enabled by default
- Engagement projection enabled by default (`calendarSyncCount` hydration)

## Engagement Tracking Contract

- `POST /api/track` records event actions (`click`, `outbound_click`, `calendar_sync`)
- `POST /api/track/discovery` records search/filter behavior
- `POST /api/user/preference` records authenticated genre preferences
- "saved this" UX maps to aggregate `calendar_sync` counts

## Canonical Stores

- Event store: `app_event_store_columns`, `app_event_store_rows`, `app_event_store_meta`, `app_event_store_settings`
- Scheduling: `app_featured_event_schedule`, `app_promoted_event_schedule`
- Engagement: `app_event_engagement_stats`, `app_discovery_analytics_stats`, `app_user_genre_preferences`
- Other app state: `app_kv_store`, `app_event_submissions`, `app_rate_limit_counters`, `app_partner_activation_queue`

## Code Map

- `app/` routes and route handlers
- `features/data-management/` runtime orchestration + admin write actions
- `features/events/` event domain logic, UI, tracking actions
- `features/events/featured/` spotlight scheduling
- `features/events/promoted/` promoted scheduling
- `features/partners/` activation queue + partner stats
- `features/security/` rate limiting and anti-abuse primitives
- `lib/platform/` logging, KV adapters, Postgres repositories

## Related Docs

- [Event Identity](./event-identity.md)
- [Engagement Tracking](./engagement-tracking.md)
- [Admin Workflow](../operations/admin-workflow.md)
- [Rate Limiting](../security/rate-limiting.md)
- [API Endpoints](../reference/api-endpoints.md)
