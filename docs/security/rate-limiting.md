# Security: Rate Limiting

Public write and tracking endpoints are protected with in-app Postgres-backed atomic counters. Edge WAF can still be layered for additional protection.

## Endpoints Covered

- `POST /api/auth/verify`
- `POST /api/event-submissions`
- `POST /api/track`
- `POST /api/track/discovery`
- `POST /api/user/preference`

## Auth Verify Limits

`POST /api/auth/verify`

- IP: `60 requests / 60 seconds`
- Email + IP: `6 requests / 15 minutes`
- Block response: `429` + `Retry-After`
- Limiter unavailable behavior: fail-open (request allowed)

## Event Submission Limits

`POST /api/event-submissions`

- IP: `20 requests / 10 minutes`
- Email + IP: `5 requests / 60 minutes`
- Fingerprint: `1 request / 24 hours`
- Block response: `429` + `Retry-After`
- Limiter unavailable behavior: fail-closed (`503`)

## Tracking Limits

`POST /api/track`

- IP: `240 requests / 60 seconds`
- Session: `200 requests / 60 seconds`
- On limiter failure or block: route returns accepted response (`202`) without recording

`POST /api/track/discovery`

- IP: `180 requests / 60 seconds`
- Session: `150 requests / 60 seconds`
- On limiter failure or block: route returns accepted response (`202`) without recording

`POST /api/user/preference`

- IP: `120 requests / 60 seconds`
- Invalid/unauthenticated requests are accepted-noop (`202`)

## Submission Abuse Checks

For event submissions, additional checks include:

- Honeypot field
- Minimum completion-time signal
- Spam-signaled payload moderation flags

## Data and Privacy

- Counter table: `app_rate_limit_counters`
- Limiter keys are HMAC-hashed with `AUTH_SECRET`
- Raw IP/email are not persisted in limiter key material

## Cleanup

- Cron route: `GET /api/cron/cleanup-rate-limits`
- Auth: `Authorization: Bearer <CRON_SECRET>`
- Behavior: deletes expired counters with grace window
