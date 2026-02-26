# Geocoding

## Behaviour

- **With API**: If `GOOGLE_MAPS_API_KEY` is set and the Geocoding API is enabled in Google Cloud Console, addresses are geocoded and events get precise coordinates.
- **Without API or on REQUEST_DENIED**: One warning is logged (e.g. “Geocoding API unavailable — using arrondissement centre for all events”). Every event then uses the centre of its arrondissement; no per-address error spam.
- **Missing data**: Events with no valid location or arrondissement are skipped for coordinates (no log line per event).
- **Storage**: Coordinate lookup entries are stored in KV (`maps:locations:v1`) instead of local disk.
- **Warm-up**: Admin store writes trigger one coordinate warm pass so later live reads mostly serve from stored coordinates.
- **Prune**: Warm-up prunes coordinate keys not present in the latest dataset.
- **Auto-upgrade**: Cached `estimated` coordinates are retried and upgraded to `geocoded` when API access is available again.

## Enabling the API

1. In [Google Cloud Console](https://console.cloud.google.com/apis/library?filter=category:maps), enable **Geocoding API** for the project that owns `GOOGLE_MAPS_API_KEY`.
2. Ensure the key is allowed for the Geocoding API (and optionally restrict by HTTP referrer or IP).

If the API is not enabled, you’ll see a single warning at runtime and arrondissement fallback will be used.
