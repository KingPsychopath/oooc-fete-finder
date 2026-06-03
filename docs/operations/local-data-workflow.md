# Local Data Workflow

Use this policy when deciding how local development should read event data.

## Canonical Model

- Canonical event truth is the managed Postgres event store.
- `data/events.csv` is a generated fallback snapshot of that truth.
- `DATA_MODE=remote` is the normal local and production-parity mode.
- `DATA_MODE=local` is only for fallback testing or no-database work.

## Recommended Local Setup

For release checks and feature work that touches runtime behavior, run locally against Postgres:

```bash
DATA_MODE=remote
DATABASE_URL=postgresql://...
```

Use a local or preview Postgres database for mutating admin work whenever possible. Production Postgres should be treated as read-only from local shells unless the task is explicitly an operational production edit.

## Keeping The Fallback Fresh

Before release, refresh the checked-in fallback snapshot from the current managed store:

```bash
pnpm db:pull-events-csv
```

This reads `DATABASE_URL` and writes `data/events.csv`. It does not write to Postgres.

After pulling, verify the fallback still parses and the app still builds:

```bash
pnpm test -- __tests__/integration/local-csv-fallback.test.ts
pnpm build
```

## Seeding A Postgres Store

For a new local or preview database, seed from `data/events.csv`:

```bash
pnpm bootstrap:postgres-store
```

The bootstrap script seeds from available project event data and only writes event rows when the event-store table is empty.

## When To Use DATA_MODE=local

Use `DATA_MODE=local` only to confirm the emergency CSV path works or when no database is available. It does not exercise Postgres tables, admin store writes, backups, restores, user plans, saved events, analytics, rate limits, or production database failure modes.
