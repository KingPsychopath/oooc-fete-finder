# Offline Access Goals

This document tracks the remaining work for durable offline access and smaller event UI islands.

## Current State

The homepage route architecture is in a good place for offline work:

- `app/page.tsx` is still a Server Component shell.
- `app/HomeEventsSection.tsx` fetches initial live events/settings server-side.
- `EventsClient` now wraps the event experience with explicit client data providers.

Implemented so far:

- Service worker cleanup was removed.
- `components/ServiceWorkerRegistration.tsx` registers `/sw.js` in production.
- `public/sw.js` caches the app shell and same-origin static assets.
- `features/events/offline-event-snapshot.ts` stores the latest event snapshot in IndexedDB.
- `features/events/components/events-offline-provider.tsx` owns live/saved payload state, freshness, and full event hydration.
- `features/events/components/EventsDataStatusBanner.tsx` displays saved-data freshness.
- `features/events/components/events-search-filters-provider.tsx` owns filter/search state, ordered event lists, sort mode, and auth-gated search/OOOC Picks behavior.

## Target Architecture

The target homepage client architecture is:

```tsx
<EventsOfflineProvider>
  <EventsSearchFiltersProvider>
    <EventsHomeExperience>
      <EventsDataStatusBanner />
      <EventsSearchFiltersIsland />
      <EventListIsland />
      <EventsMapIsland />
      <EventModalIsland />
      <AuthGatedControlsIsland />
    </EventsHomeExperience>
  </EventsSearchFiltersProvider>
</EventsOfflineProvider>
```

The goal is not to rewrite the page. The goal is to keep shrinking `EventsClient` into explicit islands with stable responsibilities.

## Phase 1: Finish Search/Filter Island

Goal: Move search/filter rendering out of `events-client.tsx` now that state lives in `EventsSearchFiltersProvider`.

Tasks:

- Create `features/events/components/EventsSearchFiltersIsland.tsx`.
- Move `SearchBar` slot construction into the island or a small child component.
- Move desktop/mobile `FilterPanel` rendering into the island.
- Keep `AuthGate` behavior unchanged.
- Keep `onAuthRequired`, `dynamicSearchChips`, and panel close/open callbacks passed explicitly.
- Verify search, filters, OOOC Picks, auth gate, and offline-grace messaging still behave the same.

Done when:

- `events-client.tsx` no longer imports `SearchBar` or lazy-loads `FilterPanel` directly.
- Filter/search UI reads from `useEventsSearchFilters()`.
- `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` pass.

## Phase 2: Extract Event List Island

Goal: Move list rendering and list-specific controls out of `events-client.tsx`.

Tasks:

- Create `features/events/components/EventListIsland.tsx`.
- Move `AllEvents` rendering into the island.
- Consume `allEventsOrdered`, `sortMode`, `setSortMode`, `hasAnyActiveFilters`, and `activeFiltersCount` from `useEventsSearchFilters()`.
- Pass only orchestration callbacks from the shell:
  - `onEventClick`
  - `onAuthRequired`
  - `allEventsRef`
  - optional search slot or rendered search/filter island output
- Keep list behavior identical before changing layout.

Done when:

- `events-client.tsx` no longer imports `AllEvents` directly.
- `EventListIsland` owns list UI wiring.
- Quality gates pass.

## Phase 3: Extract Featured/Stats Surface

Goal: Separate derived discovery display from URL/modal orchestration.

Tasks:

- Create `features/events/components/EventsDiscoverySummaryIsland.tsx`.
- Move `FeaturedEvents`, `EventStats`, and OOOC Picks callout rendering into it.
- Consume `spotlightEventsOrdered`, `filteredEvents`, `defaultDateRange`, `socialProofDisplayModes`, and `selectedOOOCPicks` from `useEventsSearchFilters()`.
- Pass only `onEventClick` and `onScrollToAllEvents` from the shell.

Done when:

- `events-client.tsx` no longer imports `FeaturedEvents` or `EventStats`.
- OOOC Picks callout lives with the discovery summary UI.
- Quality gates pass.

## Phase 4: Extract Events Map Island

Goal: Make the map a separately loaded, offline-aware surface.

Tasks:

- Create `features/events/components/EventsMapIsland.tsx`.
- Move lazy `EventsMapCard` import into the island.
- Consume `filteredEvents`, `hasAnyActiveFilters`, and `activeFiltersCount` from `useEventsSearchFilters()`.
- Keep `isMapExpanded` either in the shell initially or move it into the map island if no other component needs it.
- Add clear offline behavior before attempting tile caching:
  - saved event pins can render from IndexedDB data
  - failed map style/tile loads do not break event browsing
  - map shell can show a concise offline fallback

Done when:

- `events-client.tsx` no longer lazy-loads `EventsMapCard`.
- Map loading failure does not block list/search/modal usage.
- Quality gates pass.

## Phase 5: Extract Event Modal Island

Goal: Isolate URL-selected event and modal behavior.

Tasks:

- Create `features/events/components/EventModalIsland.tsx`.
- Move `EventModal` rendering and request-update open state into the island if possible.
- Keep URL canonicalization in the shell until the modal route behavior is fully understood.
- Move event details hydration into either:
  - `EventsOfflineProvider`, if details should update saved event snapshots, or
  - `EventModalIsland`, if details are purely modal-specific.
- Decide whether event detail payloads need their own IndexedDB store.

Done when:

- `events-client.tsx` no longer imports `EventModal` directly.
- Event detail fetch failures degrade cleanly offline.
- Quality gates pass.

## Phase 6: Extract Auth-Gated Controls

Goal: Centralize email/auth/update-request gates.

Tasks:

- Create `features/events/components/AuthGatedControlsIsland.tsx` or a small auth gate provider if needed.
- Move `EmailGateModal` lazy import and modal state out of `events-client.tsx`.
- Keep `useAuth()` calls near auth behavior.
- Preserve offline-grace banners and signed-out offline messaging.
- Keep request-update gates working from event modals.

Done when:

- `events-client.tsx` no longer owns email gate modal state.
- Auth prompts are controlled through explicit callbacks/context.
- Quality gates pass.

## Phase 7: Strengthen Offline Data

Goal: Make saved data more durable and observable.

Tasks:

- Add snapshot schema/version metadata to IndexedDB records.
- Add snapshot validation before restoring saved events.
- Add stale-data thresholds:
  - fresh saved data
  - stale but usable data
  - missing data
- Add retry/sync state to `EventsOfflineProvider`:
  - `idle`
  - `refreshing`
  - `saved`
  - `error`
- Add a manual refresh affordance if product design wants it.
- Consider saving event detail responses separately.

Done when:

- Invalid saved data is ignored safely.
- The freshness banner reflects stale/missing/error states.
- Quality gates pass.

## Phase 8: Service Worker Upgrade

Goal: Move from the plain service worker to a production-grade strategy when needed.

Tasks:

- Decide whether to keep the hand-written `public/sw.js` or move to Serwist.
- If moving to Serwist, add the dependency intentionally and update Next config.
- Add runtime caching for safe JSON endpoints:
  - `/api/events/live`
  - non-sensitive event detail responses
- Avoid caching auth/session/admin endpoints.
- Add cache versioning and cleanup strategy.
- Test hard-refresh offline after first successful online visit.

Done when:

- App shell loads offline after prior visit.
- Saved event data restores offline.
- Sensitive endpoints are not cached.
- Quality gates pass.

## Phase 9: Offline Map Strategy

Goal: Treat maps as a separate offline problem.

Tasks:

- Inventory map assets:
  - style JSON
  - sprites
  - glyphs
  - tiles
- Decide whether true offline tiles are required or whether offline fallback is enough.
- If true offline maps are required, define geographic bounds and storage budget.
- Add graceful fallback copy when map assets are unavailable.
- Keep list/search fully usable without map assets.

Done when:

- Offline map behavior is explicit and tested.
- Map failures cannot break event discovery.

## Suggested Next `/goals` Task

Start here:

```text
Use docs/architecture/offline-access-goals.md. Implement Phase 1 only: extract EventsSearchFiltersIsland without changing behavior. Run pnpm lint, pnpm exec tsc --noEmit, and pnpm build.
```

