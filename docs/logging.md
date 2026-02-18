# Logging

## Overview

- **Platform logger**: `lib/platform/logger.ts` — scope + message + optional context; dev = human-readable, prod = JSON.
- **Startup**: `instrumentation.ts` logs one line at server start: app name, data mode, DB and geocoding status.
- **Geocoding**: Single warning when the Geocoding API is unavailable (e.g. not enabled in Cloud Console); then arrondissement centre fallback for all events. No per-address error spam.
- **Runtime data + revalidation**: Source read and revalidation errors go through the logger; periodic memory dumps and per-event “skipping coordinates” messages are disabled.
- **Dev info dedupe**: In development only, identical `info` logs (`scope + message + context`) are suppressed for a short window (~1.2s) to reduce repeated pipeline log noise.

## Usage

```ts
import { log } from "@/lib/platform/logger";

log.info("scope", "Message", { key: "value" });
log.warn("scope", "Warning");
log.error("scope", "Error", { err: message });
```

## What you won’t see anymore

- Repeated `Geocoding failed for "..."` per address
- `Skipping coordinates for "..." (arr: unknown)`
- `Memory Usage: X MB / Y MB` on every check
- No runtime in-memory events cache tuning env vars are required.

## Dedupe Contract

- Dedupe applies only to `info` level in development.
- `warn` and `error` logs are never deduped.
- Dedupe does **not** cache, skip, or coalesce data reads; it only suppresses repeated log lines.
- Logger dedupe map in `logger.ts` (line 20) is only log suppression.
- Runtime metrics counters in `runtime-service.ts` (line 74) are telemetry only.

See `docs/environment-variables.md` for env and `docs/geocoding.md` for geocoding behaviour.
