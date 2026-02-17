# Google Output Deprecation Checklist

This project now writes auth-modal user submissions to the managed user store first (`app_kv_store` via Postgres when available).

Google output is optional mirror-only behavior.

## Current state (recommended)

- `GOOGLE_MIRROR_WRITES=false`
- `GOOGLE_SHEETS_URL` set only if you still need temporary mirror writes
- Admin export from `Collected Users` is your primary handoff format

## Full deprecation steps

1. Confirm `/admin` `Collected Users` reflects live auth submissions.
2. Keep mirror disabled for at least one full workflow cycle and validate no data loss.
3. Remove `GOOGLE_SHEETS_URL` from environment variables.
4. Remove legacy Apps Script admin surfaces that are no longer used:
   - Google stats cards
   - Google recent entries cards
   - Google cleanup actions
5. Keep CSV import/export in admin for editor familiarity.

## What stays after deprecation

- Postgres-backed user/event storage
- Local CSV fallback for runtime resilience
- Admin CSV export for operations workflows
