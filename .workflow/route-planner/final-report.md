Accepted:
- Dedicated route planner domain with canonical plan and stop types.
- Deterministic suggested-route engine based on event date, time, category, coordinates, saved/recent signals, and user-selected preferences.
- Local-first plans provider backed by localStorage and account sync through /api/user/plans.
- Ordered Postgres persistence through app_user_plans and app_user_plan_stops.
- Mobile-first /plans page with transit-line stop visualization, route suggestions, guided preferences, plan tour affordance, and explicit move/remove/lock controls.
- Add-to-plan entry points from homepage event modals and direct event pages.
- Mobile nav now promotes Plans and moves Submit Event into More.
- Adversarial fixes for cross-owner plan id writes and shared offline mutation queue ownership.
- Explicit multi-route creation from Saved routes, visible per-route delete buttons, and 10 routes per day as the canonical product cap.
- Lock buttons now mean “keep this stop in the next suggestion”, expose pressed state, show a Kept badge, and expand suggestions when locked stops exceed the requested stop count.
- Start preference is nullable: no selected chip means Any start; Day, Evening, and Late toggle on/off without a separate Any button.
- Provider/API route cap enforcement mirrors the UI so stale clicks and future callers cannot create unlimited routes.

Rejected:
- Drag reorder. User explicitly rejected drag; canonical reorder is explicit controls.
- Saved-events-as-plans bridge. Plans are their own ordered itinerary state.
- Raw AI as canonical route output. Suggestions are deterministic.

Verification:
- `pnpm test -- route-suggestion pending-mutation-queue user-plan-repository`
- `pnpm test -- route-suggestion add-event-to-plan pending-mutation-queue`
- `pnpm build`
- `pnpm exec biome check ...` on touched route planner files
- In-app browser smoke on `http://127.0.0.1:3001/plans` mobile viewport: suggested route applied, 3 stops rendered, move up/down/remove controls present.
- In-app browser smoke on `http://localhost:3000/plans`: page renders without error boundary, nullable Start controls and route cap copy are present, lock controls are labelled.
- Direct event modal smoke: Add event to plan button appears after hydration.

Remaining risks:
- Local route-plan storage is not yet included in legacy email-to-userId local-storage migration.
- Build uses Node v24 locally while package expects Node 22, producing an engine warning.
