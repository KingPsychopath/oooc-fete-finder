# Architecture Contract

This file defines the rendering/auth/data contract for the app. Treat this as implementation guardrails.

## Rendering Model

1. Public routes are static-first.
- Examples: `/`, `/feature-event`, content pages.
- Prefer ISR/static rendering with runtime source reads (Postgres first in remote mode).
- Do not add request-bound APIs (`cookies()`, `headers()`) in root layout or public route trees unless absolutely required.

2. Admin routes are server-authenticated and dynamic.
- Examples: `/admin` and admin API routes.
- Validate admin session/JWT on the server before rendering protected data or handling mutations.

3. Root layout must remain static.
- `app/layout.tsx` is shared infrastructure and should not read auth cookies.
- Keep global shell cacheable.

## Auth Model

1. User auth (`oooc_user_session`) for public UX is centralized in `AuthProvider`.
- Bootstrap once via `/api/auth/session`.
- Components should consume auth context, not run their own session fetch effects.

2. Admin auth (`oooc-admin-auth`) is authoritative on server boundaries.
- Required for admin pages, admin actions, and admin APIs.
- Client may read admin auth state from centralized session bootstrap for UI hints only (e.g. nav link).

3. Header contract.
- No component-local `useEffect` fetches for auth or banner settings.
- Header receives server-provided public settings (banner) and reads auth state from context.

## Data + Revalidation Model

1. Public data should use source-of-truth reads.
- Use Postgres-backed runtime reads for events and explicit revalidation for public surfaces.

2. Admin mutations must revalidate.
- After writes, call `revalidateTag`/`revalidatePath` for affected public surfaces.

3. Avoid duplicate client fetches.
- If data can be provided by server props or centralized context, prefer that over per-component fetch-on-mount patterns.

## Performance Rules

1. Default to server-rendered HTML for content and structure.
2. Keep client islands focused on interactivity only.
3. Do not let auth handling force full-app dynamic rendering.
4. Treat map-heavy bundles as an optimization track (lazy-loading/splitting), separate from auth/revalidation contract.

## Decision Log

Current chosen architecture:
- Static-first public shell + centralized client auth bootstrap + server-authenticated admin boundaries.

Future option (only if product requires exact auth-correct first paint):
- Introduce a dynamic auth island/partial prerendering boundary for auth-specific UI while preserving static shell for the rest.
