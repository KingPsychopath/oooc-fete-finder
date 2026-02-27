# Engagement Tracking and "Saved" Signals

This doc defines how event engagement tracking works, including the social-proof text (`"X people saved this"`) and admin analytics behavior.

## What "Saved This" Means

In this app, "saved" maps to `calendar_sync` actions.

- A user clicks `Add to Calendar` in the event modal
- Client tracking sends `actionType=calendar_sync` to `POST /api/track`
- The event engagement store increments counts for that event
- Runtime event payloads project `calendarSyncCount` back onto each event
- UI surfaces social proof like `"X people saved this"`

Important:

- This is a count of calendar sync interactions, not a persistent "saved list" feature
- Counts are aggregate; public UI does not expose individual identities

## Tracked Event Actions

`POST /api/track` supports:

- `click` (event open/view)
- `outbound_click` (external/ticket link click)
- `calendar_sync` (calendar add interaction)

These write to `app_event_engagement_stats` with:

- `event_key`
- `action_type`
- `session_id` (if available)
- `source`
- `path`
- `is_authenticated`
- `recorded_at`

## Discovery + Preference Tracking

Additional first-party analytics routes:

- `POST /api/track/discovery`
- Tracks `search`, `filter_apply`, `filter_clear`
- Writes to `app_discovery_analytics_stats`

- `POST /api/user/preference`
- Tracks authenticated genre preference increments
- Writes to `app_user_genre_preferences`

## Admin Analytics Surface

Analytics is available in `/admin/insights`:

- `Event Engagement Stats` card
- Event-level ROI metrics (views, outbound, calendar)
- Discovery analytics (top searches and filters)
- Audience segmentation CSV export

The dashboard uses server actions from `features/events/engagement/actions.ts`.

## Partner Reporting

Partner campaign snapshots derive from tracked engagement actions:

- `GET /api/partner-stats/[activationId]?token=...`
- Optional CSV export via `format=csv`
- Includes view/outbound/calendar metrics and rates for fulfilled spotlight/promoted activations

## Privacy and Identity Boundaries

- Public social proof uses aggregate counts only
- Discovery segmentation can include authenticated user email when available in first-party context
- Partner-facing stats are aggregate campaign metrics
- Raw IP/email are not stored in rate-limit key material; limiter keys are HMAC-hashed

## Runtime Projection Contract

`getLiveEvents()` can project engagement counts by default:

- `includeEngagementProjection` defaults to `true`
- Projection reads calendar sync counts and sets `event.calendarSyncCount`
- Analytics and admin workflows can disable this projection when raw reads are needed
