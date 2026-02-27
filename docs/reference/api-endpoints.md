# API Endpoints Reference

## Public Auth + Submission

- `POST /api/auth/verify`: validates user details and sets `oooc_user_session`
- `GET /api/auth/session`: returns current public auth session state
- `POST /api/event-submissions`: accepts host event submissions (subject to settings + limits)

## Public Tracking

- `POST /api/track`: event engagement tracking (`click`, `outbound_click`, `calendar_sync`)
- `POST /api/track/discovery`: discovery analytics tracking (`search`, `filter_apply`, `filter_clear`)
- `POST /api/user/preference`: authenticated user genre preference signal

## Public Media + Utility

- `GET /api/og`: OG image generation endpoint
- `GET /api/partner-stats/[activationId]`: tokenized partner stats snapshot (`?token=...`)
- `GET /api/partner-stats/[activationId]?token=...&format=csv`: partner stats CSV export

## Admin Endpoints (Authenticated)

- `GET /api/admin/health`
- `GET /api/admin/data-store/status`
- `GET /api/admin/postgres/kv`
- `GET /api/admin/tokens/sessions`
- `DELETE /api/admin/tokens/sessions/[jti]`
- `POST /api/admin/tokens/revoke`

## Revalidation Endpoint

- `GET/POST /api/revalidate/deploy`
- Requires `Authorization: Bearer <DEPLOY_REVALIDATE_SECRET>`

## Webhook Endpoint

- `POST /api/webhooks/stripe`: Stripe webhook ingestion for partner activation queue

## Cron Endpoints

- `GET /api/cron/cleanup-admin-sessions`
- `GET /api/cron/cleanup-rate-limits`
- `GET /api/cron/backup-event-store`

All cron routes require `Authorization: Bearer <CRON_SECRET>`.
