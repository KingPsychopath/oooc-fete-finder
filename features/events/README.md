# Events Feature

Core event domain: types, filtering, display, submissions, engagement tracking, and paid/featured placement projection.

- `types.ts` - Event types, constants, and helpers for price, age, time of day, and normalization.
- `events-service.ts` - Server-side event data access through the runtime source chain.
- `filtering.ts` - Pure filter logic for date, genre, arrondissement, accessibility, price, and related facets.
- `calendar-utils.ts` - Add-to-calendar and event-date helpers.
- `hooks/use-event-filters.ts` - Client hook for filter state and derived filtered lists.
- `components/` - Event list, card, modal, filters, search, and stats UI.
- `engagement/` - Tracking actions, client tracking helpers, and analytics types.
- `featured/` - Featured scheduling and display.
- `promoted/` - Promoted placement projection and admin actions.
- `submissions/` - Public event-submission form, moderation store, and submission settings.

Server vs client: pages and data flow are server-first; only interactive UI (filters, modals, map) uses `"use client"`.
