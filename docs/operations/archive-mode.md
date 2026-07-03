# Archive Mode

Archive mode is a dormant off-season runtime for a frozen public Fete Finder
archive. It is implemented but should stay disabled until the production event
CSV and static archive support data have been refreshed from the live database.

## Flags

Keep these false for live production:

```env
ARCHIVE_MODE=false
NEXT_PUBLIC_ARCHIVE_MODE=false
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

To enable the archive later, set both archive flags to `true`. `ARCHIVE_MODE`
controls server behavior, and `NEXT_PUBLIC_ARCHIVE_MODE` controls bundled
client behavior. `ARCHIVE_MODE=true` forces event reads to the bundled CSV even
if `DATA_MODE=remote` remains set.

## What Still Works

- Public event browsing, search, filters, maps, event detail pages, and static
  assets.
- Map pins hydrate from the bundled `data/event-locations.json` archive instead
  of Postgres KV.
- Planner routes in localStorage. Account sync is disabled. The official
  `/plans/fete` and `/plans/fete-2026` route pages resolve from the bundled
  published-plan archive.
- Ticket Exchange in local browser demo mode. Users can save a local contact
  profile, create local listings, reply to demo listings, and exercise owner
  lifecycle actions. Nothing is visible to other browsers.
- Admin `/admin` becomes a read-only archive status page showing CSV load state
  and archive behavior.
- Local app settings, theme, and map preference controls.

## What Is Disabled

- Login, user sessions, saved-account data, user app-setting sync, notices, and
  saved event sync.
- User-created shared plan links that were not explicitly published into the
  archive.
- Partner stats reports.
- First-party analytics, discovery analytics, ticket-exchange analytics, and
  genre preference writes.
- Event submissions, event-update submissions, paid promotion intake, Stripe
  webhook ingestion, cron database maintenance, and Ticket Exchange bot writes.
- Full admin dashboard and admin write workflows.

## Enable Checklist

1. Refresh `data/events.csv` from production while Postgres is still connected:

```bash
pnpm db:pull-events-csv
```

2. Refresh static archive support data while Postgres is still connected:

```bash
pnpm archive:pull-static-data
```

This writes:

- `data/event-locations.json` for map pins and nearby sorting.
- `data/archive-published-plans.json` for published official routes.
- `data/archive-site-settings.json` for small public UI settings.

3. Confirm `pnpm build` passes with `ARCHIVE_MODE=true` and
   `NEXT_PUBLIC_ARCHIVE_MODE=true`.
4. Set Railway production variables:

```env
ARCHIVE_MODE=true
NEXT_PUBLIC_ARCHIVE_MODE=true
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_TELEMETRY_DISABLED=1
```

5. Leave `DATA_MODE=remote` if you want a one-command rollback, or set
   `DATA_MODE=local` for clarity. Archive mode forces local reads either way.
6. After deploy, check `/admin`, `/exchange`, `/plans`, `/plans/fete`,
   `/submit-event`, and
   `/feature-event`.
7. If the archive is stable, consider detaching Postgres from the app service
   after exporting a backup. Keep the Railway database only if you still need
   admin/history access.

## Login Behavior

Archive mode treats every visitor as signed out. The client auth provider clears
offline auth grace, does not fetch a live session, and hides login/logout/admin
controls from public navigation. `/api/auth/session` returns a successful
signed-out response with `archiveMode: true` and clears the user auth cookie.
Lookup and verification endpoints return archive-disabled errors, so no login
codes are sent or accepted.

## Rollback

Set both archive flags back to `false`, restore `NEXT_PUBLIC_ANALYTICS_ENABLED`
to `true`, and redeploy. Keep `DATABASE_URL` and `DATA_MODE=remote` available if
you want login/admin/exchange to come back immediately.
