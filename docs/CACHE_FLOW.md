# Cache Flow

This app now uses a minimal cache architecture with one generic runtime cache primitive and one shared invalidation policy.

## Generic Core

- Generic runtime cache primitive: `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/lib/cache/runtime-cache.ts`
- Shared invalidation policy (tags + paths): `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/lib/cache/cache-policy.ts`

## Events Cache

- Read entrypoint: `CacheManager.getEvents()` in `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/lib/cache/cache-manager.ts`
- Write/refresh entrypoint: `CacheManager.forceRefresh()` in `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/lib/cache/cache-manager.ts`
- Invalidation exitpoint: `invalidateEventsCache()` in `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/lib/cache/cache-policy.ts`

### Lifecycle

1. App requests events.
2. `CacheManager.getEvents()` asks generic `RuntimeCache` for data.
3. If runtime cache is fresh (TTL), return cached value.
4. If stale/missing, load fresh events from `DataManager`.
5. If load fails, serve existing stale cached data if available.
6. Admin refresh triggers `forceRefresh()` and policy invalidation.

## Startup Warmup

- Startup hook: `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/instrumentation.ts`
- On Node server boot, `register()` calls `CacheManager.prewarmInBackground()`.
- This warms events cache before typical first homepage request, reducing first-hit latency.

## Sliding Banner Cache

- Read entrypoint: `getPublicSlidingBannerSettingsCached()` in `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/features/site-settings/queries.ts`
- Invalidation exitpoint: `invalidateSlidingBannerCache()` in `/Users/owenamenze/workspace/github.com/personal/oooc-fete-finder/features/site-settings/cache.ts`

### Lifecycle

1. Page calls `getPublicSlidingBannerSettingsCached()`.
2. Next cache stores by key/tag for `SLIDING_BANNER_REVALIDATE_SECONDS`.
3. Admin saves/toggles banner settings.
4. Action persists settings, then invalidates banner tag + layout paths.
5. Next request gets fresh settings.
