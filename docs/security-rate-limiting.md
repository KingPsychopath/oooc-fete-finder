# Security: Rate Limiting

This app enforces layered protection for public write endpoints:

1. Vercel WAF edge rule (outer shield).
2. In-app Postgres atomic counters (business enforcement).

## Deployment Status

Implemented and active as of February 18, 2026:

- Vercel WAF custom rule for `POST /api/auth/verify` is enabled.
- In-app Postgres atomic limiter is enabled in the route.
- In-app Postgres atomic limiter is enabled for `POST /api/event-submissions`.

This means abusive traffic can be stopped at the edge first, and any traffic
that reaches the route is still enforced by app-level business limits.

## In-app Limits (`/api/auth/verify`)

- IP scope (`auth_verify_ip`): `60 requests / 60 seconds`
- Email+IP scope (`auth_verify_email_ip`): `6 requests / 15 minutes`

When blocked, the endpoint returns:

- Status: `429`
- Body: `{ "success": false, "error": "Too many attempts. Please try again shortly." }`
- Headers: `Retry-After` + `Cache-Control: no-store` (and related no-cache headers)

## In-app Limits (`/api/event-submissions`)

- IP scope (`event_submit_ip`): `20 requests / 10 minutes`
- Email+IP scope (`event_submit_email_ip`): `5 requests / 60 minutes`
- Fingerprint scope (`event_submit_fingerprint`): `1 request / 24 hours`

Additional spam heuristics:

- Hidden honeypot field
- Minimum form completion time (`<4s` flagged)

Spam-flagged payloads are stored as declined with `review_reason=spam_signal`, and the endpoint returns a generic success response.

## Privacy and Logging

- Raw IP and email are not persisted in limiter storage.
- Keys are HMAC-hashed using `AUTH_SECRET`.
- Fail-open warnings log only hashed identifiers (`keyHash`) and scope/reason.

## Failure Behavior

- If Postgres limiter storage is unavailable, the endpoint fails open.
- Requests continue (to reduce user lockout risk) and warnings are logged.
- Vercel WAF remains the first-line shield.

## Data and Cleanup

Counters are stored in Postgres table:

- `app_rate_limit_counters`

Rows are cleaned daily by cron:

- `GET /api/cron/cleanup-rate-limits`
- Secured with `Authorization: Bearer <CRON_SECRET>`
- Deletes counters stale for more than 24 hours past `reset_at` across all scopes

## Vercel WAF Recommendation

Configure a WAF rate rule for `/api/auth/verify` with thresholds above in-app limits.

Suggested starting point:

- Window: 1 minute
- Threshold: slightly above app IP limit (for example `80/min`)

This ensures edge filtering handles obvious abuse while app-level logic remains authoritative.
