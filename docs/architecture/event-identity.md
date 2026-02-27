# Event Identity (`eventKey`)

This app uses a stable event identity model so shared links survive row reorders and content edits.

## Core Model

Each event has:

1. `eventKey`: canonical immutable identity (for example `evt_...`)
2. Event content: editable fields (name, date, location, etc.)
3. `slug`: human-readable URL text (decorative)

Only `eventKey` is canonical for lookup.

## URL Contract

Public share links use:

- `/event/<eventKey>/<slug>/`

This route sets share metadata and then redirects into homepage modal state using:

- `event`: canonical identity key
- `slug`: optional display text

Example:

- `/event/evt_ab12cd34ef56/example-event-name/`
- Redirect target: `/?event=evt_ab12cd34ef56&slug=example-event-name`

If `slug` is wrong, the app still resolves by `event`.

## CSV + Admin Behavior

- CSV imports accept `Event Key` column aliases and map to `eventKey`
- Missing/invalid keys are generated and persisted on save/import
- CSV exports include `Event Key`
- In admin editor, `Event Key` is read-only

## Determinism Rules

- Existing valid `eventKey` is preserved across edits
- Missing keys are generated from normalized row content
- Collisions are resolved deterministically

## What Breaks Existing Links

1. Manually changing/removing an existing `Event Key`
2. Importing CSV data without `Event Key` after keys were already established
3. Intentionally assigning a new identity for what should be treated as a different event

## Operational Note

After enabling/refactoring identity behavior, run one admin save/import cycle so generated keys are persisted in store and future exports.
