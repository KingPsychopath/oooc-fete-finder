# Event Identity and Share Links (`eventKey`)

This doc explains how stable event links work for both admin editors and CSV upload workflows.

## Mental model

Think of each event as having:

1. **Identity**: `eventKey` (immutable, canonical, machine key like `evt_abc123...`)
2. **Content**: name/date/time/location/price/etc. (can change)
3. **Display URL text**: `slug` (human-readable, non-canonical)

Identity should stay the same when content changes.

## URL model

Deep links use query params:

- `event`: canonical key used for lookup
- `slug`: decorative text only

Example:

- `/?event=evt_ab12cd34ef56&slug=imersiv-summer-party-day-1`

If `slug` is wrong/tampered, the app still resolves by `event` and rewrites slug to canonical.

## CSV + Admin workflow (non-technical)

### If you upload/import CSV

1. Keep the `Event Key` column in the file.
2. If a row has no `Event Key`, the app auto-generates one on save/import.
3. Exports include `Event Key`, so future import/export cycles preserve identity.

### If you edit in Admin panel

1. `Event Key` is visible but read-only.
2. You edit event details normally.
3. Save/revalidate keeps identity stable.

## Determinism rules

### Existing valid key present

- If `eventKey` already exists and is valid (`evt_...`), it is preserved.
- Updating event content does **not** change that key.

### Key missing or invalid

- A deterministic key is generated from normalized core row fields.
- If two generated keys collide, deterministic salting (`#2`, `#3`, etc.) resolves uniqueness.

## What happens when event data changes?

- **With existing valid `eventKey`**: key stays unchanged (preferred behavior).
- **Without `eventKey` yet**: generated key may differ if source row content changed before first persisted save.

## What can break old links?

1. Manually editing/deleting an existing `Event Key` in CSV.
2. Importing from a CSV that drops the `Event Key` column entirely.
3. Intentionally assigning a different key to represent a new identity.

## Performance impact

Runtime impact is small:

1. Key generation is lightweight string normalization + SHA-256 hashing when keys are missing.
2. URL-modal sync uses query-param reads and a map lookup by `eventKey`.
3. No extra network round-trips were added for modal open/close.

In practice this should be negligible compared with map rendering and existing event processing.

## Rollout note

After enabling this feature, run one admin save/import cycle so existing rows persist generated keys permanently. After that, links remain stable across normal edits/reorders.
