# Admin Workflow

Use this when operating the new admin console.

## Admin Areas

The admin panel is split into focused modules:

1. `/admin` - overview and quick launch
2. `/admin/operations` - runtime status, data store controls, session controls, recovery
3. `/admin/content` - event sheet editor, submissions moderation, sliding banner
4. `/admin/placements` - paid orders queue, spotlight/promoted schedulers
5. `/admin/insights` - engagement analytics and collected user exports

## Standard Publish Flow (Content + Operations)

1. Open `/admin/content`
2. Update events in `Event Sheet Editor`
3. If needed, review `Event Submissions`
4. Update banner settings if needed
5. Open `/admin/operations`
6. Create a safety snapshot in `Event Store Controls` (`Backup Now`)
7. Click `Save and Revalidate Homepage`
8. Verify results in `Live Runtime Snapshot`

## Placements Flow

1. Open `/admin/placements`
2. Review `Paid Orders Queue`
3. Fulfill queue items into Spotlight or Promoted schedules
4. Confirm queue status in `Spotlight & Promoted Scheduler`
5. Share generated partner stats link when needed

## Insights Flow ("Who Saved" + Tracking)

1. Open `/admin/insights`
2. Use `Event Engagement Stats` to inspect:
- views (`click`)
- outbound clicks (`outbound_click`)
- calendar saves (`calendar_sync`)
3. Review top events, discovery metrics, and conversion rates
4. Export audience CSV segments where required

Clarification:

- `"saved this"` in product/admin maps to calendar sync interactions
- It is aggregate engagement signal, not a user-visible personal saved-events list

## Rollback Flow

1. Open `/admin/operations`
2. Restore `Latest Backup` or a selected snapshot
3. Revalidate homepage
4. Confirm restored payload in `Live Runtime Snapshot`

## Health and Access Checks

- `GET /api/admin/health`
- `GET /api/admin/data-store/status`
- `GET /api/admin/postgres/kv`
- `GET /api/admin/tokens/sessions`

## Common Failure Cases

- Save succeeds but publish looks stale: run save/revalidate again and verify runtime source
- Spotlight/promoted schedule not applying: verify event keys and queue status in Placements
- Analytics panel empty: confirm Postgres connectivity and track routes are reachable
- Submission endpoint closed: check `Event Submissions` settings in Content
