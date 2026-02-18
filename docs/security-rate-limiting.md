# Security: Auth Verify Rate Limiting

This app enforces layered protection for `POST /api/auth/verify`:

1. Vercel WAF edge rule (outer shield).
2. In-app Postgres atomic counters (business enforcement).

## In-app Limits

- IP scope (`auth_verify_ip`): `60 requests / 60 seconds`
- Email+IP scope (`auth_verify_email_ip`): `6 requests / 15 minutes`

When blocked, the endpoint returns:

- Status: `429`
- Body: `{ "success": false, "error": "Too many attempts. Please try again shortly." }`
- Headers: `Retry-After` + `Cache-Control: no-store` (and related no-cache headers)

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
- Deletes counters stale for more than 24 hours past `reset_at`

## Vercel WAF Recommendation

Configure a WAF rate rule for `/api/auth/verify` with thresholds above in-app limits.

Suggested starting point:

- Window: 1 minute
- Threshold: slightly above app IP limit (for example `80/min`)

This ensures edge filtering handles obvious abuse while app-level logic remains authoritative.
