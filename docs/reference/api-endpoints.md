# API Endpoints Reference

## Public Auth + Submission

- `POST /api/auth/verify`: validates user details and sets `oooc_user_session`
- `POST /api/auth/lookup`: same-origin user lookup for known profile details
- `GET /api/auth/session`: returns current public auth session state
- `DELETE /api/auth/session`: clears the current public user session
- `POST /api/event-submissions`: accepts host event submissions (subject to settings + limits)

## Public Tracking

- `POST /api/analytics/event`: event engagement tracking (`click`, `outbound_click`, `calendar_sync`)
- `POST /api/analytics/discovery`: first-party traffic and discovery analytics tracking (`page_view`, `search`, `filter_apply`, `filter_clear`, map/sort/location/tour/nav signals)
- `POST /api/analytics/ticket-exchange`: ticket-exchange interaction tracking
- `POST /api/user/preferences`: authenticated user genre preference signal

## Public Event, Plans + User State

- `GET /api/events/[eventKey]`: event detail JSON for client hydration/offline-safe detail cache
- `GET /api/ticket-exchange/events/[eventKey]/summary`: public ticket-exchange listing summary for one event
- `GET /api/user/app-settings`: authenticated synced app settings
- `POST /api/user/app-settings`: authenticated synced app settings update
- `GET /api/user/plans`: authenticated saved route plans
- `POST /api/user/plans`: authenticated create/update route plan
- `DELETE /api/user/plans`: authenticated delete route plan
- `GET /api/user/saved-events`: authenticated saved event keys
- `POST /api/user/saved-events`: authenticated save/unsave event state

## Public Media + Utility

- `GET /api/og`: OG image generation endpoint (`route.tsx`)
- `HEAD /api/og`: OG cache header probe
- `GET /api/client-health`: uncached client connectivity probe for offline fallback gating
- `GET /api/partner-stats/[activationId]`: tokenized partner stats snapshot (`?token=...`)
- `GET /api/partner-stats/[activationId]?token=...&format=csv`: partner stats CSV export

## Admin Endpoints (Authenticated)

- `GET /api/admin/health`
- `GET /api/admin/data-store/status`
- `GET /api/admin/deployment-status`
- `GET /api/admin/event-sheet`
- `POST /api/admin/event-sheet`
- `GET /api/admin/event-sheet/ocr-draft`
- `POST /api/admin/event-sheet/ocr-draft`
- `POST /api/admin/music-genre-taxonomy`
- `GET /api/admin/storage/kv`
- `GET /api/admin/tokens/sessions`
- `DELETE /api/admin/tokens/sessions/[jti]`
- `POST /api/admin/tokens/revoke`

## Revalidation Endpoint

- `POST /api/revalidate/deploy`
- Requires `Authorization: Bearer <DEPLOY_REVALIDATE_SECRET>`

## Webhook Endpoint

- `POST /api/webhooks/stripe`: Stripe webhook ingestion for partner activation queue

## Ticket Exchange Bot Endpoints

All bot routes require `TICKET_EXCHANGE_BOT_SECRET` authorization.

- `GET /api/ticket-exchange/bot/recent-listings`
- `GET /api/ticket-exchange/bot/listings/[listingId]/status`
- `POST /api/ticket-exchange/bot/announce-callback`

## Cron Endpoints

- `GET /api/cron/cleanup-admin-sessions`
- `GET /api/cron/cleanup-rate-limits`
- `GET /api/cron/backup-event-store`
- `GET /api/cron/cleanup-dismissed-partner-reports`

All cron routes require `Authorization: Bearer <CRON_SECRET>`.
