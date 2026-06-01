export const PLAN_ANALYTICS_ACTIONS = [
	"prompt_shown",
	"prompt_dismissed",
	"tour_start",
	"tour_complete",
	"tour_skip",
	"tour_close",
	"date_select",
	"suggest_route",
	"regenerate_route",
	"new_route",
	"open_route",
	"rename_route",
	"delete_route",
	"add_saved_event",
	"add_event_from_modal",
	"add_event_dialog_open",
	"add_event_dialog_existing_route",
	"reorder_stop",
	"drag_reorder_stop",
	"remove_stop",
	"pin_stop",
	"unpin_stop",
	"share_create",
	"share_copy",
	"share_revoke",
	"share_owner_name_toggle",
	"shared_plan_view",
	"shared_plan_save",
	"shared_plan_copy",
	"shared_plan_open_planner",
	"route_calendar_export",
	"route_map_open",
] as const;

export type PlanAnalyticsAction = (typeof PLAN_ANALYTICS_ACTIONS)[number];

export const PLAN_ANALYTICS_SURFACES = [
	"planner",
	"planner_modal",
	"route_dialog",
	"share",
	"shared_plan",
	"shared_plan_modal",
	"tour",
	"export",
] as const;

export type PlanAnalyticsSurface = (typeof PLAN_ANALYTICS_SURFACES)[number];
export type PlanAnalyticsGroup = `plan:${PlanAnalyticsSurface}`;

export const getPlanAnalyticsGroup = (
	surface: PlanAnalyticsSurface,
): PlanAnalyticsGroup => `plan:${surface}`;

export const PLAN_ANALYTICS_GROUPS = PLAN_ANALYTICS_SURFACES.map(
	getPlanAnalyticsGroup,
);

const PLAN_ANALYTICS_ACTION_SET: ReadonlySet<string> = new Set(
	PLAN_ANALYTICS_ACTIONS,
);
const PLAN_ANALYTICS_GROUP_SET: ReadonlySet<string> = new Set(
	PLAN_ANALYTICS_GROUPS,
);

export const isPlanAnalyticsAction = (
	value: string,
): value is PlanAnalyticsAction => PLAN_ANALYTICS_ACTION_SET.has(value);

export const isPlanAnalyticsGroup = (
	value: string,
): value is PlanAnalyticsGroup => PLAN_ANALYTICS_GROUP_SET.has(value);
