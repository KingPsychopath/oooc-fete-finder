# Offline Mutation Queue

This queue is for user-visible state changes that must survive offline mode and retry later.

Current consumer:

- `saved_event` for save/unsave event state.

When adding future stateful writes, add a mutation type only after the product surface exists. Expected future consumers:

- route edits
- itinerary ordering
- notify-me toggles
- user-facing profile or preference writes

Best-practice rules:

- Scope every mutation by `ownerKey` so account state never bleeds between users.
- Include an idempotency key.
- Compact last-write-wins mutations when possible.
- Keep analytics queues separate from state mutation queues.
- Prefer server endpoints that accept final desired state, not fragile action replay.
