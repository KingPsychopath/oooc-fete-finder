# Environment Variables

Validation schema: `lib/config/env.ts`

## Server Variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `AUTH_SECRET` | Yes | - | Minimum 32 chars; used for JWT/cookies and hashed security keys |
| `ADMIN_KEY` | No | `""` | If empty, admin auth is disabled |
| `ADMIN_RESET_PASSCODE` | No | - | Optional admin reset passcode |
| `DATABASE_URL` | No | - | Postgres connection string |
| `POSTGRES_POOL_MAX` | No | - | Optional pool tuning |
| `DATA_MODE` | Prod on Vercel: Yes | `remote` | `remote`, `local`, or `test` |
| `GOOGLE_MAPS_API_KEY` | No | - | Enables address geocoding |
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
| `NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_STANDARD` | - | Partner checkout link |
| `NEXT_PUBLIC_STRIPE_LINK_SPOTLIGHT_TAKEOVER` | - | Partner checkout link |
| `NEXT_PUBLIC_STRIPE_LINK_PROMOTED` | - | Partner checkout link |
| `NEXT_PUBLIC_STRIPE_LINK_ADDON_WHATSAPP` | - | Partner checkout add-on link |
| `NEXT_PUBLIC_STRIPE_LINK_ADDON_NEWSLETTER` | - | Partner checkout add-on link |

`NEXT_PUBLIC_DEPLOYMENT_ID` and the public Stripe Payment Link values are optional runtime reads and are listed in `.env.example`; they are intentionally not required for local development.

## Production Notes

- In Vercel `preview`/`production`, missing `DATA_MODE` triggers startup failure
- For Postgres-backed runtime behavior, set `DATABASE_URL` and `DATA_MODE=remote`

## Secret Generation

```bash
openssl rand -base64 48  # AUTH_SECRET / CRON_SECRET / DEPLOY_REVALIDATE_SECRET
openssl rand -hex 24     # ADMIN_KEY
```
