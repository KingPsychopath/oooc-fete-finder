# Environment Variables

Validation schema for core runtime variables: `lib/config/env.ts`.
Some optional diagnostics and maintenance-script variables are read directly from
`process.env` and are still listed here and in `.env.example`.

## Server Variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `AUTH_SECRET` | Yes | - | Minimum 32 chars; used for JWT/cookies and hashed security keys |
| `ADMIN_KEY` | No | `""` | If empty, admin auth is disabled |
| `ADMIN_AUTH_TTL_HOURS` | No | `24` | Admin cookie/JWT lifetime in hours; values above 168 are capped to 168 |
| `ADMIN_RESET_PASSCODE` | No | - | Optional admin reset passcode |
| `DATABASE_URL` | No | - | Postgres connection string |
| `POSTGRES_URL` | No | - | Script-only fallback for maintenance commands when `DATABASE_URL` is unset |
| `POSTGRES_POOL_MAX` | No | - | Optional pool tuning |
| `ALLOW_LOCAL_ENV_OVERRIDE` | No | - | Development-only escape hatch. Set to `1` only when intentionally letting shell env override critical project env values like `DATABASE_URL` or `DATA_MODE` |
| `DATA_MODE` | Production: Yes | `remote` | `remote`, `local`, or `test` |
| `SKIP_ENV_VALIDATION` | No | - | Optional escape hatch for special build/test workflows |
| `GOOGLE_MAPS_API_KEY` | No | - | Enables address geocoding |
| `EVENT_OCR_PROVIDER` | No | `gemini` | Admin event sheet OCR provider. Supported today: `gemini` |
| `EVENT_OCR_MODEL` | No | `gemini-2.5-flash-lite` | OCR vision model name passed to the selected provider |
| `EVENT_OCR_API_KEY` | No | - | Generic OCR provider API key; preferred for provider-agnostic config |
| `GEMINI_API_KEY` | No | - | Gemini-specific fallback key when `EVENT_OCR_API_KEY` is unset |
| `EVENT_OCR_TIMEOUT_MS` | No | `25000` | Per-image OCR provider timeout |
| `CRON_SECRET` | No | - | Protects cron endpoints |
| `DEPLOY_REVALIDATE_SECRET` | No | - | Protects deploy revalidation endpoint |
| `STRIPE_WEBHOOK_SECRET` | No | - | Verifies Stripe webhook events for partner activation ingestion |
| `STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_STANDARD` | No | - | Maps Stripe Payment Link IDs to partner package keys |
| `STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_TAKEOVER` | No | - | Maps Stripe Payment Link IDs to partner package keys |
| `STRIPE_PAYMENT_LINK_ID_PROMOTED` | No | - | Maps Stripe Payment Link IDs to partner package keys |
| `STRIPE_PAYMENT_LINK_ID_ADDON_WHATSAPP` | No | - | Maps Stripe Payment Link IDs to partner add-on keys |
| `STRIPE_PAYMENT_LINK_ID_ADDON_NEWSLETTER` | No | - | Maps Stripe Payment Link IDs to partner add-on keys |

## Client Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_PATH` | `""` | Optional subpath deploy |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical site origin |
| `NEXT_PUBLIC_DEPLOYMENT_ID` | - | Optional public deployment/build identifier used by admin deploy-change detection |
| `NEXT_PUBLIC_OG_IMAGE_VERSION` | - | Optional cache-busting version appended to generated OG image URLs |
| `NEXT_PUBLIC_WHATSAPP_URL` | - | Community invite link |
| `NEXT_PUBLIC_SPOTIFY_PLAYLIST_URL` | - | Spotify playlist link |
| `NEXT_PUBLIC_APPLE_MUSIC_PLAYLIST_URL` | - | Apple Music playlist link |
| `NEXT_PUBLIC_YOUTUBE_MUSIC_PLAYLIST_URL` | - | YouTube Music playlist link |
| `NEXT_PUBLIC_OOOC_WEBSITE_URL` | - | Parent brand website link |
| `NEXT_PUBLIC_OOOC_INSTAGRAM_URL` | - | Parent brand Instagram link |
| `NEXT_PUBLIC_OOOC_TIKTOK_URL` | - | Parent brand TikTok link |
| `NEXT_PUBLIC_OOOC_CONTACT_URL` | - | Contact link |
| `NEXT_PUBLIC_OOOC_FAQ_URL` | - | FAQ link |
| `NEXT_PUBLIC_CREATOR_X_URL` | - | Creator attribution/social link |
| `NEXT_PUBLIC_SUPPORT_COFFEE_URL` | - | Support link |
| `NEXT_PUBLIC_TOILET_FINDER_IOS_URL` | - | iOS utility app link |
| `NEXT_PUBLIC_TOILET_FINDER_ANDROID_URL` | - | Android utility app link |
| `NEXT_PUBLIC_FOOD_GUIDE_URL` | - | Food guide link |
| `NEXT_PUBLIC_PRICE_RATE_GBP_TO_EUR` | `1.154` | Price-filter normalization rate |
| `NEXT_PUBLIC_PRICE_RATE_USD_TO_EUR` | `0.854` | Price-filter normalization rate |
| `NEXT_PUBLIC_ENGAGEMENT_ANALYTICS_SAMPLE_RATE` | `0.25` | Sampling rate for low-value event engagement actions; high-value actions such as saves/calendar/outbound clicks are always kept |
| `NEXT_PUBLIC_DISCOVERY_ANALYTICS_SAMPLE_RATE` | `0.25` | Sampling rate for search/filter/map/sort/location discovery analytics |
| `NEXT_PUBLIC_LOW_VALUE_ANALYTICS_SAMPLE_RATE` | `0` | Sampling rate for low-value nav/tour analytics |
| `NEXT_PUBLIC_GENRE_PREFERENCE_ANALYTICS_SAMPLE_RATE` | `0.25` | Sampling rate for genre preference analytics |
| `NEXT_PUBLIC_AUTH_TIMING_LOG` | - | Set to `1` to log browser auth refresh timing outside normal development logging |
| `NEXT_PUBLIC_OFFLINE_DEBUG` | - | Set to `1` to show the offline diagnostics panel without a query/localStorage toggle |

`NEXT_PUBLIC_DEPLOYMENT_ID`, `NEXT_PUBLIC_OG_IMAGE_VERSION`, diagnostics flags,
and analytics sample rates are optional runtime reads and are listed in
`.env.example`; they are intentionally not required for local development.

## Provider And Test Variables

These values are read when the platform or tooling provides them. They are not
required app configuration and generally should not be set by hand in local
`.env` files.

- `NEXT_RUNTIME`: provided by Next.js runtime execution.
- `CI`: provided by CI systems; Playwright uses it to choose retries/reporting.
- `RAILWAY_DEPLOYMENT_ID`, `RAILWAY_GIT_COMMIT_SHA`, and
  `RAILWAY_ENVIRONMENT_NAME`: provided by Railway when available.
- `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_SHA`, and `VERCEL_URL`: supported
  as deployment-id fallbacks if a Vercel-like environment ever supplies them.
- `BUILD_ID`: optional generic server-side build identifier when provider commit
  or deployment vars are absent.
- `PLAYWRIGHT_BASE_URL`: optional e2e target for Playwright; defaults to
  `http://localhost:3000`.

## Maintenance Script Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:3000` | Used by health and public-route check scripts |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | Used by Playwright when tests target an existing server |
| `TARGET_URL` | - | Required by `scripts/railway-cron-trigger.mjs` |
| `EVENT_PATH` | Built-in sample event path | Route checked by `scripts/check-public-routes.mjs` |
| `MAX_EVENT_HTML_BYTES` | `120000` | Event HTML budget for public-route checks |
| `MAX_HOME_HTML_BYTES` | `360000` | Home HTML budget for public-route checks |
| `MAX_JS_CHUNK_BYTES` | `1250000` | Per-chunk JS budget for public-route checks |
| `MAX_TOTAL_JS_CHUNK_BYTES` | `5000000` | Total JS budget for public-route checks |
| `USER_ID_DRIFT_LOOKBACK_DAYS` | `30` | Recent-window size for identity drift checks |
| `USER_ID_DRIFT_ALLOWED_UNRECOVERABLE_MISSING_WITH_EMAIL` | `0` | Allowed unrecoverable recent identity misses with email |
| `USER_ID_DRIFT_ALLOWED_MISSING_WITH_EMAIL` | `0` | Legacy alias for the allowed missing-with-email threshold |
| `USER_ID_DRIFT_ALLOWED_MALFORMED_IDS` | `0` | Allowed recent malformed identity values |
| `USER_ID_SESSION_LOOKBACK_DAYS` | `30` | Session mapping window for user identity backfills |

## Production Notes

- In `NODE_ENV=production`, missing `DATA_MODE` triggers startup failure
- For Postgres-backed runtime behavior, set `DATABASE_URL` and `DATA_MODE=remote`
- In local development, startup fails if shell env already has different critical values than the project env file, currently `DATABASE_URL` or `DATA_MODE`. Run `unset DATABASE_URL` / `unset DATA_MODE` before `pnpm dev`, or set `ALLOW_LOCAL_ENV_OVERRIDE=1` for an intentional one-off override.

## Secret Generation

```bash
openssl rand -base64 48  # AUTH_SECRET / CRON_SECRET / DEPLOY_REVALIDATE_SECRET
openssl rand -hex 24     # ADMIN_KEY
```
