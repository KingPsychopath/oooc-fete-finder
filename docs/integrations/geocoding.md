# Geocoding

## Behavior

- If `GOOGLE_MAPS_API_KEY` is configured and API access works: store geocoded coordinates
- If API is unavailable/denied: fall back to arrondissement-center coordinates
- Missing location context: coordinate assignment may be skipped

## Storage + Warmup

- Coordinate cache is stored in KV under `maps:locations:v1`
- Admin write operations run a coordinate warm pass
- Warmup can prune stale coordinate keys
- Estimated entries can be upgraded later when geocoding becomes available

## Enablement Checklist

1. Enable Google Geocoding API in Cloud Console
2. Ensure key is valid for Geocoding API
3. Set `GOOGLE_MAPS_API_KEY` in env
