# Offline Access Goals

This document records the current offline-access architecture, what has been
completed, and what still needs production hardening.

## Current State

The homepage keeps its server-rendered shell while the event experience is split
into smaller client islands:

```tsx
<EventsOfflineProvider>
  <EventsSearchFiltersProvider>
    <EventsDataStatusBanner />
    <EventsDiscoverySummaryIsland />
    <EventsMapIsland />
    <EventsSearchFiltersIsland>
      <EventListIsland />
    </EventsSearchFiltersIsland>
    <EventModalIsland />
    <AuthGatedControlsIsland />
  </EventsSearchFiltersProvider>
</EventsOfflineProvider>
```

The offline path now supports a first successful online visit followed by a hard
reload while offline:

- `components/ServiceWorkerRegistration.tsx` registers `/sw.js` in production.
- `public/sw.js` precaches the app shell, runtime-caches safe same-origin static
  assets, runtime-caches safe event JSON endpoints, and excludes admin/auth/user
  endpoints.
- `components/ServiceWorkerRegistration.tsx` seeds the service worker static
  cache with same-origin scripts, styles, fonts, and favicons discovered during
  the first online page load. This closes the first-visit gap where an initially
  uncontrolled page can load critical hashed chunks before the service worker is
  able to runtime-cache them.
- `features/events/offline-event-snapshot.ts` saves the homepage event snapshot
  and event detail snapshots to IndexedDB with schema name/version metadata and
  validation before restore.
- `features/events/components/events-offline-provider.tsx` owns live/saved event
  state, saved snapshot freshness, sync state, and full event hydration.
- `features/events/components/use-event-detail-hydration.ts` owns event detail
  fetch, validation, IndexedDB persistence, and saved-detail fallback.
- `features/events/components/EventsDataStatusBanner.tsx` reports saved,
  stale, missing, and error states.
- `features/events/components/EventsMapIsland.tsx` and
  `features/maps/components/ParisMapLibre.tsx` keep map failures from blocking
  event discovery and show offline fallback copy.
- `e2e/event-routes.spec.ts` includes a real browser offline test that waits for
  service worker readiness and IndexedDB snapshot persistence, switches the
  browser context offline, reloads, and verifies saved event list/search plus map
  fallback.

## Completed Phases

### 1. Search And Filter Island

Completed.

- `EventsSearchFiltersIsland` owns `SearchBar` construction and filter panel
  rendering.
- Search, filter state, OOOC Picks, sorting inputs, and auth gating read from
  `EventsSearchFiltersProvider`.
- `events-client.tsx` no longer imports `SearchBar` or lazy-loads `FilterPanel`
  directly.

### 2. Event List Island

Completed.

- `EventListIsland` owns `AllEvents` wiring.
- The island consumes ordered events, sort mode, active-filter state, and clear
  filter actions from `EventsSearchFiltersProvider`.
- `events-client.tsx` no longer imports `AllEvents` directly.

### 3. Discovery Summary Island

Completed.

- `EventsDiscoverySummaryIsland` owns the featured events, event stats, and OOOC
  Picks callout.
- Discovery summary state comes from `EventsSearchFiltersProvider`.
- `events-client.tsx` no longer imports `FeaturedEvents` or `EventStats`
  directly.

### 4. Events Map Island

Completed for graceful offline fallback.

- `EventsMapIsland` lazy-loads the map card and consumes filtered event state.
- `ParisMapLibre` handles offline and map asset failures without blocking
  saved-event browsing.
- True offline map tiles are not implemented.

### 5. Event Modal Island

Completed for island extraction and offline detail hydration.

- `EventModalIsland` owns modal rendering.
- URL selection and canonicalization remain in `events-client.tsx`, which is
  still the route orchestration shell.
- Event detail hydration lives in `use-event-detail-hydration.ts`.
- Successful `/api/events/[eventKey]` payloads are saved to the
  `event-detail-snapshots` IndexedDB store.
- Offline or failed detail hydration falls back to a validated saved detail
  snapshot when one exists.

### 6. Auth-Gated Controls

Completed.

- `AuthGatedControlsIsland` owns the email gate modal and auth prompt state.
- Offline grace and signed-out offline messaging remain wired through auth
  context and `events-client.tsx`.
- Request-update gates continue to flow through the modal callbacks.

### 7. Offline Data Durability

Completed for homepage event snapshots.

- IndexedDB snapshots include schema metadata and event counts.
- Invalid, mismatched, or malformed saved data is ignored safely.
- Saved data freshness supports fresh, stale, missing, and error states.
- `EventsOfflineProvider` exposes `idle`, `refreshing`, `saved`, and `error`
  sync states.
- Unit tests cover schema validation, invalid saved data, and freshness logic.

### 8. Service Worker Baseline

Completed as a hand-written baseline.

- The app shell is available offline after a prior successful visit.
- Same-origin static assets are cached at runtime.
- Safe event JSON endpoints are cached:
  - `/api/events/live`
  - `/api/events/[eventKey]`
- Sensitive endpoint families are explicitly excluded:
  - `/admin`
  - `/api/admin`
  - `/api/auth`
  - `/api/cron`
  - `/api/revalidate`
  - `/api/user`
  - `/api/webhooks`
  - `/partner-stats`
- Cache versioning and old-cache cleanup are implemented with a cache version
  prefix.
- The controlled page sends loaded static resources to the service worker so
  critical homepage chunks are cacheable after one successful online visit.

### 9. Offline Browser Verification

Completed.

- Playwright visits the homepage online.
- The test waits for `navigator.serviceWorker.ready`.
- The test waits until the IndexedDB `event-snapshots/home` record contains a
  valid `home-events` schema snapshot.
- The browser context is switched offline and the page is reloaded.
- The test verifies saved events, offline search/list filtering, and map fallback
  copy.

## Current Known Limits

### Event Detail Offline Caching

Event detail caching is implemented for events opened during a prior online
session. The durable source is the versioned `event-detail-snapshots` IndexedDB
store; the service worker's safe `/api/events/[eventKey]` runtime cache remains
a secondary network-response cache.

Known limit:

- Event detail fallback requires the detail payload to have been opened and saved
  online before the offline session.

### Map Tiles And Map Assets

True offline maps are not implemented. MapLibre style, sprite, glyph, and tile
assets are treated as online-only. The current product behavior is graceful
fallback copy plus fully usable saved list/search/filter surfaces.

Production hardening tasks:

- Decide whether true offline tiles are a product requirement.
- If yes, define geographic bounds, zoom levels, storage budget, expiry policy,
  attribution requirements, and tile provider terms.
- If no, keep the fallback explicit and test it as the supported offline map
  behavior.

### Service Worker Strategy

The current service worker is intentionally small and hand-written. It is enough
for app shell fallback, static assets, and safe event JSON caching, but it is not
a full Workbox/Serwist strategy.

Production hardening tasks:

- Decide whether to keep the hand-written service worker or migrate to Serwist.
- Extend observability for install, activate, cache hit/miss, and offline
  fallback paths if production debugging needs it.
- Review cache eviction and storage pressure behavior on mobile browsers.
- Verify `Cache-Control` behavior for all safe event JSON responses.
- Add a manual refresh affordance only if product design wants user-controlled
  sync.

### Offline Debug Access

The homepage includes an internal `OfflineDebugPanel` mounted near the saved-data
banner. It shows the service worker version, service worker controller state,
event snapshot saved time, snapshot freshness, event data source, auth mode,
offline grace expiry, protected discovery access, and browser cache names.

Debug panel entry points:

- Development builds: visible automatically, but service worker fields will show
  unavailable/not controlled because service worker registration is disabled in
  `pnpm dev`.
- Production one-off: add `?offlineDebug=1` to the homepage URL.
- Production persistent browser toggle: run
  `localStorage.setItem("oooc_offline_debug", "1")` in DevTools, then reload.
- Production build-wide toggle: set `NEXT_PUBLIC_OFFLINE_DEBUG=1` at build time.

To hide the persistent browser toggle, run
`localStorage.removeItem("oooc_offline_debug")` and reload.

Use this panel when diagnosing stale data, missed service worker control, or an
offline grace issue before clearing browser storage. The source of truth for
event freshness is the IndexedDB snapshot `savedAt` value and the provider's
`live`/`saved` data source, not the service worker cache alone.

### Offline Auth And Search

Search and filters remain auth-gated. Offline search works for users with a
valid offline grace state from a prior authenticated session. Signed-out offline
users can still browse saved event cards, but protected discovery controls stay
locked.

Production hardening tasks:

- Confirm whether signed-out offline users should get read-only search over
  saved data, or whether current auth-gated behavior is intentional.
- Add product copy for expired offline grace if support tickets show confusion.

## Offline QA Checklist

Use this checklist before treating offline behavior as production-ready after
future changes:

- Build in production mode; service worker registration is production-only.
- Visit `/` online and wait for the first event card to render.
- Confirm `navigator.serviceWorker.ready` resolves.
- If auth-gated filters should work offline, sign in online and confirm the
  debug panel shows `Auth mode: live`, `Protected discovery: allowed`, and a
  future `Offline grace expires` value before switching offline.
- Confirm IndexedDB database `oooc-fete-finder`, store `event-snapshots`, key
  `home` contains:
  - `metadata.schemaName === "home-events"`
  - `metadata.schemaVersion === 1`
  - `metadata.eventCount === events.length`
  - non-empty `events`
  - valid ISO `savedAt`
- Switch the browser context offline.
- Hard reload `/`.
- Verify the saved-events banner appears.
- Verify event cards render from the saved snapshot.
- Verify saved-event search/list filtering works for an offline-grace user.
- Verify signed-out offline behavior still locks protected discovery controls.
- Verify the map area shows graceful offline fallback copy and does not block
  list/search/modal interactions.
- Verify direct event pages degrade acceptably offline, especially for event
  details not already present in the homepage snapshot.
- Confirm IndexedDB database `oooc-fete-finder`, store
  `event-detail-snapshots`, key `<eventKey>` contains:
  - `metadata.schemaName === "event-detail"`
  - `metadata.schemaVersion === 1`
  - `metadata.eventKey === event.eventKey`
  - valid event payload
  - valid ISO `savedAt`
- Verify sensitive routes and endpoints are not served from service worker cache.
- Run:
  - `pnpm lint`
  - `pnpm exec tsc --noEmit`
  - `pnpm test`
  - `pnpm build`
  - `pnpm test:e2e`

## Suggested Next Work

The remaining work is production hardening, not another broad extraction phase.
Good next goals are:

- Decide the map product requirement: explicit online-only fallback or bounded
  true offline tiles.
- Add service worker observability and storage-pressure checks.
- Expand offline QA around expired offline grace and sensitive endpoint cache
  exclusions.

## Final Offline Acceptance Pass

Last verified: 2026-05-09.

Acceptance result: pass for the supported offline scope.

Verified in production-mode Playwright against the built app:

- First online visit renders the homepage event list.
- `navigator.serviceWorker.ready` resolves and a controlled page is available
  after reload.
- `_next/static` resources are present in service worker cache before the
  offline transition.
- The web app manifest is linked at `/manifest.webmanifest`.
- IndexedDB persists the home event snapshot with `home-events` schema metadata.
- IndexedDB persists opened event details with `event-detail` schema metadata.
- Offline hard reload restores saved events.
- Offline grace state allows saved-event OOOC Picks filtering, search, and list
  behavior.
- An event modal reopens offline from saved detail data.
- The map area shows the supported online-only asset fallback copy.
- Reconnect plus reload returns to live event rendering and clears the saved
  events banner.
- Requests to `/api/auth/session`, `/api/user/preference`, and
  `/api/admin/health` are not present in service worker caches.
- No browser console or page error matching `ChunkLoadError` or chunk loading
  failure was observed during the offline flow.

Serwist decision: still not justified. The fix required first-load static cache
seeding plus existing runtime caching, not a generated precache manifest. Serwist
would become more compelling if the app needs broad build-manifest precaching,
cache expiration policies, or richer service worker lifecycle tooling.

Commands run for this pass:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm test`
- `pnpm test:e2e -- e2e/event-routes.spec.ts --grep "offline acceptance pass"`
