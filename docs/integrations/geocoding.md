# Location Resolution

## Behavior

- Event loading does not require geocoding and should never fail because a provider is missing.
- If a provider is configured and API access works: store trusted geocoded coordinates.
- If API is unavailable/denied: arrondissement-center coordinates can be used only as approximate area fallback.
- Missing location context remains unresolved.
- Nearby-event matching should use trusted `manual`/`geocoded` coordinates, not arrondissement centroids.
- Map links prefer text search unless trusted coordinates are available.

## Storage + Warmup

- Coordinate cache is stored in KV under `maps:locations:v1`
- Admin write operations can run a coordinate warm pass
- Warmup can prune stale coordinate keys
- Estimated entries can be upgraded later when geocoding becomes available
- Runtime homepage reads do not mutate the coordinate cache

## Enablement Checklist

1. Enable Google Geocoding API in Cloud Console
2. Ensure key is valid for Geocoding API
3. Set `GOOGLE_MAPS_API_KEY` in env

## Architecture

- `features/locations/location-resolver.ts` owns provider-neutral resolution policy.
- `features/locations/providers/*` adapts concrete geocoding providers.
- `features/locations/map-link-builder.ts` chooses trusted coordinates vs text search.
- `features/locations/nearby-event-service.ts` calculates nearby events from trusted coordinates.
