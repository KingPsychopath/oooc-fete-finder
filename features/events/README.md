# Events feature

Core event domain: types, filtering, display, and featured curation.

- **types.ts** — Event types, constants, and small helpers (price, age, day/night).
- **events-service.ts** — Server-side event data access (uses cache).
- **filtering.ts** — Pure filter logic (date, genre, arrondissement, etc.).
- **calendar-utils.ts** — Add-to-calendar and date helpers.
- **hooks/use-event-filters.ts** — Client hook for filter state and derived filtered list.
- **components/** — Event list, card, modal, filters, search, stats, share image.
- **featured/** — Featured events block (selection, countdown, header); lives here as event curation, not a separate feature.

Server vs client: pages and data flow are server-first; only interactive UI (filters, modals, map) uses `"use client"`.
