# API Endpoints Reference

## Public Endpoints

- `POST /api/auth/verify`: validates user details and sets `oooc_user_session`
- `GET /api/auth/session`: returns current public auth session state
- `POST /api/event-submissions`: accepts host event submissions (subject to settings + limits)
- `GET /api/og`: OG image generation endpoint

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

## Cron Endpoints

- `GET /api/cron/cleanup-admin-sessions`
- `GET /api/cron/cleanup-rate-limits`
- `GET /api/cron/backup-event-store`

All cron routes require:

- `Authorization: Bearer <CRON_SECRET>`
