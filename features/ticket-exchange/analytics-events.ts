export const TICKET_EXCHANGE_ANALYTICS_ACTIONS = [
	"exchange_view",
	"event_select",
	"event_details_open",
	"tab_change",
	"sort_change",
	"profile_open",
	"profile_save",
	"agreement_open",
	"agreement_accept",
	"listing_form_open",
	"listing_create",
	"contact_unlock",
	"contact_link_click",
	"listing_status_update",
	"listing_repost",
	"report_open",
	"report_submit",
	"flow_blocked",
	"validation_error",
	"action_failed",
	"empty_state_cta",
	"tour_prompt_shown",
	"tour_prompt_dismiss",
	"tour_start",
	"tour_complete",
	"tour_skip",
] as const;

export type TicketExchangeAnalyticsAction =
	(typeof TICKET_EXCHANGE_ANALYTICS_ACTIONS)[number];

export const TICKET_EXCHANGE_ANALYTICS_SURFACES = [
	"marketplace",
	"event_filter",
	"listing_card",
	"profile_panel",
	"listing_form",
	"agreement_modal",
	"report_modal",
	"event_modal",
	"tour",
] as const;

export type TicketExchangeAnalyticsSurface =
	(typeof TICKET_EXCHANGE_ANALYTICS_SURFACES)[number];

const ACTION_SET: ReadonlySet<string> = new Set(
	TICKET_EXCHANGE_ANALYTICS_ACTIONS,
);
const SURFACE_SET: ReadonlySet<string> = new Set(
	TICKET_EXCHANGE_ANALYTICS_SURFACES,
);

export const isTicketExchangeAnalyticsAction = (
	value: string,
): value is TicketExchangeAnalyticsAction => ACTION_SET.has(value);

export const isTicketExchangeAnalyticsSurface = (
	value: string,
): value is TicketExchangeAnalyticsSurface => SURFACE_SET.has(value);
