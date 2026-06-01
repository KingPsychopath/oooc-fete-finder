Read-only review result integrated from subagent Beauvoir.

Accepted findings:
- Plans need their own ordered canonical schema, not event relationships.
- Planner identity must reuse the saved-events owner key pattern to avoid anonymous/live/offline drift.
- Suggestions must be deterministic and derived from canonical event fields.
- Reorder must support accessible non-drag controls.
- Planner overlay/page should avoid conflicting with existing modal/map overlay state.
- Tests need to cover deterministic routing, persistence, and mobile flow.

Rejected findings:
- None.

Implementation decisions:
- Build app_user_plans and app_user_plan_stops.
- Use localStorage local-first provider plus account sync API.
- Keep /plans as a full page rather than route planner modal.
- Use "Add to plan" in event modal as a small action that saves a stop or starts a plan.
