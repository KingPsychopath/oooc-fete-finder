# Railway Placeholder

This directory is a tiny static fallback for the off-season Fete Finder page.
It is intentionally plain HTML and CSS served by Caddy, with no app runtime and
no client JavaScript.

The current page is a static 2026 recap. Its public numbers were generated from
the local event CSV plus aggregate-only analytics from a local Postgres dump.
The event count is `159` dated 2026 listings from `app_event_store_rows` /
`data/events.csv`; the full event store has `239` rows because it also includes
`80` legacy 2025 rows.

## Page Rules

- Keep the root page static, cacheable, and database-free.
- Redirect every non-asset route back to `/` while the finder is resting.
- Publish aggregate recap numbers only; never ship raw user rows or identifiers.
- Use JavaScript only for progressive enhancement that the page survives without.
- Keep motion subtle, useful, and disabled by `prefers-reduced-motion`.
- Preserve a calm two-line hero before the recap starts.
- Avoid repeated branding, decorative labels, awkward pills, and overflowing
  numbers.
- Keep cards at `8px` radius or below and make every number fit its own card.

## Deploy

Create or update a separate Railway service with this directory as its root:

```bash
railway up --service fete-placeholder --detach -m "Deploy static placeholder"
```

If configuring the service in the Railway dashboard, set:

- Root directory: `railway-placeholder`
- Builder: Dockerfile
- Domain port: the Railway-provided `PORT` env var, with the container fallback
  listening on `8080`

The Caddy service serves `/`, `/styles.css`, `/recap.js`, and `/favicon.svg`.
Other paths intentionally `302` redirect to `/` so old indexed Fete Finder URLs
land on the resting recap page.

## Off-Season Switch

To save money after deploying this service:

1. Move `fete.outofofficecollective.co.uk` to the placeholder service.
2. Stop or scale down the `oooc-fete-finder` app service.
3. Stop cron services.
4. Stop Postgres only after confirming no live app service still needs it.

To reactivate demos, move the domain back to `oooc-fete-finder`, start Postgres
and any needed cron services, then redeploy or restart the app service.

## Recap Data

A helper script can regenerate the aggregate recap snapshot against a restored
database:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/recap \
  RECAP_OUTPUT_PATH=tmp/recap-data/recap-data.json \
  node scripts/generate-static-recap.mjs
```

Do not ship raw database dumps or `tmp/recap-data` output. Keep recap data
aggregate-only and avoid publishing raw user identifiers.
