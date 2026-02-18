# Featured Events Scheduler

Featured events are now managed by a dedicated Postgres-backed scheduler.

## Source of truth

Do not use the legacy `Featured` CSV column to activate featuring.

- Canonical source: `app_featured_event_schedule`
- Canonical key: `eventKey`
- Admin control surface: `/admin` -> `Featured Events Manager`

## Queue model

- Max concurrent featured slots: `3`
- Default duration: `48` hours
- Scheduling timezone: `Europe/Paris`
- If more than 3 events are scheduled, overflow entries are queued by:
1. `requested_start_at`
2. `created_at`
3. `event_key`

Scheduler output persists:

- `effective_start_at`
- `effective_end_at`

## Runtime behavior

- Homepage/runtime projections set `event.isFeatured` and `event.featuredAt` from active scheduler windows only.
- Feature status surfaces can also show recently ended entries (48h window).
- Legacy free-text/timestamp parsing from CSV is no longer canonical behavior.

## Admin actions

Implemented server actions:

- `listFeaturedQueue()`
- `scheduleFeaturedEvent(eventKey, requestedStartAt, durationHours?)`
- `cancelFeaturedSchedule(entryId)`
- `rescheduleFeaturedEvent(entryId, requestedStartAt, durationHours?)`

These actions revalidate both `/` and `/feature-event` after mutation.

## Strict cutover guardrail

CSV and sheet-save flows reject non-empty legacy `Featured` values with:

`Featured selection moved to Featured Manager.`

Clear that column and use the dedicated manager.
