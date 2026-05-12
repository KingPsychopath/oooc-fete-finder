# Offline Map Reversion Note

Date: 2026-05-12

This note records the offline/connectivity changes made while investigating why
the production app could show offline UI unexpectedly, and why MapLibre could
still appear to work while Chrome DevTools was set to Offline.

## What Happened

Chrome DevTools Offline can block network requests while `navigator.onLine`
still returns `true`. In that state, the app previously trusted
`navigator.onLine`, treated the app as online, and kept MapLibre mounted.

That allowed the map to keep zooming/panning if MapLibre already had enough
style, glyph, sprite, or tile assets in memory or browser cache. This can feel
good, but it is opportunistic rather than guaranteed: a later pan, zoom, refresh,
or different browser may hit uncached map assets and fail.

## Main Behavioral Change

The app now treats online status as "app reachable", not just
`navigator.onLine`.

Changed file:

- `components/online-status-gate.tsx`

Current behavior:

- If `navigator.onLine` is `false`, the app immediately marks itself offline.
- If `navigator.onLine` is `true`, the app probes `/api/client-health`.
- If two app reachability probes fail, the app marks itself offline.
- When the app is offline, MapLibre receives `isOfflineMode=true` and is removed
  in favor of the map fallback UI.

This prevents the half-live state where requests fail with
`ERR_INTERNET_DISCONNECTED` but the app still behaves as online.

## If You Want The Old Map Behavior Back

Revert only the reachability-probe behavior in:

- `components/online-status-gate.tsx`

Specifically, go back to trusting only `navigator.onLine` for global online
state. That restores the old behavior where DevTools Offline may still leave
MapLibre mounted if Chrome reports `navigator.onLine === true`.

The copy/debug changes can stay:

- `features/events/components/EventsDataStatusBanner.tsx`
- `features/events/components/OfflineDebugPanel.tsx`
- `features/events/components/EventsMapIsland.tsx`
- `features/maps/components/ParisMapLibre.tsx`
- `features/maps/components/events-map-card.tsx`

Those only clarify "cached event data" vs "app reachable" vs "map mode".

## Tradeoff

Current behavior favors predictable offline UX:

- app unreachable means offline UI
- no misleading live MapLibre state
- cached event browsing/search/filtering remains available

Old behavior favors opportunistic map continuity:

- cached MapLibre assets may keep working while offline
- zoom/pan can feel better when the browser cache is warm
- behavior is not guaranteed across locations, zoom levels, refreshes, or
  browsers

## Related Test Coverage

The Playwright event-route spec includes coverage for the DevTools-style case:

- browser reports `navigator.onLine === true`
- app reachability is blocked
- cached event fallback appears
- MapLibre canvas is removed

File:

- `e2e/event-routes.spec.ts`

