# User ID Local Storage Migration Removal Runbook

Use this runbook when removing the temporary client-side migration from legacy
email-scoped localStorage keys to user-id-scoped keys.

## Background

The app previously stored some durable browser ownership keys as `user:<email>`.
New writes should use `user:<userId>` instead. The live-session migration exists
to move older local data forward when a returning user next gets a successful
`/api/auth/session` response.

The migration currently covers:

- `oooc:saved-events:v1:user:<email>`
- `oooc_app_settings_profile_v1:user:<email>`
- `oooc_app_settings_active_profile_v1` when it points at `user:<email>`
- `oooc:pending-mutations:v1` entries with `ownerKey: "user:<email>"`
- pending saved-event `idempotencyKey` values containing `user:<email>`

It intentionally does not remove the email-gate convenience storage:

- `oooc_last_auth_profile_v1`

## When To Remove

Do not remove immediately after the user-id storage deploy.

Recommended timing:

- Minimum: 30 days after deploy, matching the normal user auth cookie horizon.
- Preferred: 90-180 days after deploy, so dormant users have time to return and
  migrate local saved events, settings, and pending mutations.
- Safest: keep it indefinitely. The migration is small and only runs when both
  email and user id are available.

Remove earlier only if the project explicitly accepts a one-time loss/reset risk
for old local-only browser caches.

## Pre-Removal Checks

Before editing code, verify current local storage writes still use user id:

```bash
rg -n "getUserProfileStorageKey\\(|getSavedEventsOwnerKey\\(|migrateUserScopedLocalStorageKeys|migratePendingMutationOwnerKey" features components __tests__
rg -n "oooc:saved-events:v1:user:.*@|oooc_app_settings_profile_v1:user:.*@|saved_event:user:.*@" features components app
```

Expected:

- Runtime code has no new email-keyed saved-event/app-settings writes.
- Email-keyed strings may still exist in tests that cover legacy migration.
- `EmailGateModal` may still use `oooc_last_auth_profile_v1`; that is a
  separate UX decision.

## Removal Steps

1. Remove `migrateUserScopedLocalStorageKeys` import and call from
   `features/auth/auth-context.tsx`.

2. Delete `features/auth/client-storage-migration.ts`.

3. Remove `migratePendingMutationOwnerKey` from
   `features/offline-mutations/pending-mutation-queue.ts` if nothing else uses
   it.

4. Delete `__tests__/unit/client-storage-migration.test.ts`.

5. Update `__tests__/unit/pending-mutation-queue.test.ts` if it only referenced
   `migratePendingMutationOwnerKey` for migration coverage.

6. Decide whether to keep the legacy email fallback in
   `features/auth/user-profile-storage-key.ts`.

   Conservative choice: keep the fallback for one more release cycle.

   Strict cleanup choice: remove the email fallback so authenticated storage
   only uses `userId`; sessions without `userId` become anonymous/local-only for
   those browser caches.

## Verification

Run the focused checks:

```bash
pnpm -s exec biome check features/auth/auth-context.tsx features/auth/user-profile-storage-key.ts features/offline-mutations/pending-mutation-queue.ts features/events/components/saved-events-provider.tsx components/AppSettingsSync.tsx __tests__/unit/user-profile-storage-key.test.ts __tests__/unit/pending-mutation-queue.test.ts
pnpm -s exec tsc --noEmit
pnpm test -- __tests__/unit/user-profile-storage-key.test.ts __tests__/unit/pending-mutation-queue.test.ts
pnpm exec playwright test e2e/event-routes.spec.ts --workers=1
```

Then run a search sweep:

```bash
rg -n "client-storage-migration|migrateUserScopedLocalStorageKeys|migratePendingMutationOwnerKey" .
rg -n "oooc:saved-events:v1:user:.*@|oooc_app_settings_profile_v1:user:.*@|saved_event:user:.*@" features components app
```

Expected:

- No references to the deleted migration helpers.
- No runtime email-keyed ownership writes.
- Tests pass.

## Manual Smoke Test

In a browser profile with a live account session:

1. Sign in through the email gate.
2. Save and unsave an event.
3. Change app settings, map preference, and theme.
4. Open DevTools > Application > Local Storage.
5. Confirm saved-event and app-settings ownership keys use `user:<userId>`.
6. Go offline and reload.
7. Confirm offline grace still unlocks cached search and filters.

## Rollback

If users report missing saved events/settings after removal:

1. Restore `features/auth/client-storage-migration.ts`.
2. Restore the call from `AuthProvider` live-session handling.
3. Restore `migratePendingMutationOwnerKey`.
4. Redeploy.

This should migrate old local keys on the next successful live session refresh.
