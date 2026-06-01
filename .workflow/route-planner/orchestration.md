Goal:
Build a complete local-first route planner for OOOC Fete Finder with account-backed plan persistence, deterministic route suggestions, mobile-first plan UI, event add-to-plan entry points, drag/reorder, share-ready plan model, and a plan-page tour affordance.

Success criteria:
- Users can open /plans and see or create day plans.
- Users can generate suggested 2-4 stop routes from local event data and account/local activity signals.
- Users can add an event to a plan from the event modal.
- Users can reorder and remove stops on mobile and desktop.
- Plans persist locally first and sync to the local database for authenticated users.
- The data model has a canonical plans domain, not a bridge on saved events.
- The UI is polished, mobile-first, and uses a transit-line visual language.
- Verification includes unit/integration tests and a local browser smoke check.

Current context:
- Next.js app with event data, maps, saved events, auth, local-first saved events provider, Postgres repositories, and mobile bottom nav.
- Local DB support already exists via the Postgres repository factory.
- User requires canonical truths, breaking changes are acceptable, and every ticket must end with tests or verification.

Constraints:
- Do not preserve duplicate truths or add compatibility bridges.
- Do not trust raw AI output as canonical route truth.
- Prefer deterministic generated route suggestions.
- Use local first and local DB, not remote production.
- Multiple chats may have concurrent uncommitted changes; do not revert unknown work.

Risks:
- Large UI surface can regress mobile layout.
- Persistence can accidentally depend on remote env.
- Suggested-route scoring can become opaque or nondeterministic.
- Event modal changes can conflict with existing overlay/nav behavior.

Approval required:
- None for local non-destructive file edits and local tests.
- Ask before destructive git/database operations, external deploys, or remote data writes.

Workflow artifact path:
.workflow/route-planner

Work packets:
- P1 Discovery: map existing auth, saved events, event payload, route/nav, local DB/test patterns.
- P2 Data/API: canonical plan types, planner engine, Postgres repository, API routes, tests.
- P3 UI: /plans mobile-first planner, route rail visuals, drag/reorder, guided controls, tour affordance.
- P4 Event Entry: add-to-plan from EventModal using local-first provider state.
- P5 Adversarial Review: independently try to break data model, UI flow, mobile behavior, persistence, and tests.
- P6 Verification: run unit/integration/type checks and browser smoke where possible.

Integration policy:
- Accept changes only if they support the canonical plan domain and local-first behavior.
- Reject bridges that treat saved events as plans.
- Reject non-deterministic suggestion output as canonical saved plan data.
- Resolve conflicts by inspecting authoritative local source files.

Verification:
- Unit tests for route suggestion scoring/order.
- Repository/API tests for create/update/list plan flows.
- Component or browser smoke test for /plans and event modal add-to-plan flow.
- Typecheck/lint/build as feasible.

Reusable artifacts:
- Keep this workflow as a route-planner recipe if the result proves useful.
