# Events feature

Core event domain: types, filtering, display, and featured curation.

- **types.ts** — Event types, constants, and small helpers (price, age, day/night).
- **events-service.ts** — Server-side event data access (runtime source reads).
- **filtering.ts** — Pure filter logic (date, genre, arrondissement, etc.).
- **calendar-utils.ts** — Add-to-calendar and date helpers.
- **hooks/use-event-filters.ts** — Client hook for filter state and derived filtered list.
- **components/** — Event list, card, modal, filters, search, stats, share image.
- **featured/** — Featured scheduling and display (queue logic, countdown/status UI, admin actions).

Server vs client: pages and data flow are server-first; only interactive UI (filters, modals, map) uses `"use client"`.
