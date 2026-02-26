# Security: Rate Limiting

Public write endpoints are protected with in-app Postgres-backed atomic counters, with optional Vercel WAF protection at the edge.

## Endpoints Covered

- `POST /api/auth/verify`
- `POST /api/event-submissions`

## `POST /api/auth/verify` Limits

- IP: `60 requests / 60 seconds`
- Email + IP: `6 requests / 15 minutes`
- Block response: `429` + `Retry-After`
- Limiter unavailable behavior: fail-open (request allowed, warning logged)

## `POST /api/event-submissions` Limits

- IP: `20 requests / 10 minutes`
- Email + IP: `5 requests / 60 minutes`
- Fingerprint: `1 request / 24 hours`
- Block response: `429` + `Retry-After`
- Limiter unavailable behavior: fail-closed (`503`)

## Additional Submission Abuse Checks

- Honeypot field check
- Minimum completion-time signal
- Spam-signaled payloads are stored as declined for moderation

## Data + Privacy

- Counter table: `app_rate_limit_counters`
- Raw IP/email are not persisted in limiter storage keys
- Keys are HMAC-hashed using `AUTH_SECRET`

## Cleanup

- Cron route: `GET /api/cron/cleanup-rate-limits`
- Security: `Authorization: Bearer <CRON_SECRET>`
- Cleanup behavior: removes expired counters with grace window
