// Constants for FeaturedEvents configuration
export const FEATURED_EVENTS_CONFIG = {
	// Maximum number of featured events to show
	MAX_FEATURED_EVENTS: 3,

	// Duration in hours that events are featured for
	FEATURE_DURATION_HOURS: 48,

	// Pricing for featuring an event (in euros)
	FEATURE_PRICE: 60,

	// CTA message for event hosts
	CTA_MESSAGE:
		"Get noticed by thousands more yearners by promoting your event →",

	// Feature page route
	FEATURE_PAGE_ROUTE: "/feature-event",

	// Canonical scheduling timezone for admin workflow
	TIMEZONE: "Europe/Paris",

	// Recently ended window for status surfaces
	RECENT_ENDED_WINDOW_HOURS: 48,
} as const;

// Validation constants
export const FEATURED_EVENTS_LIMITS = {
	MIN_FEATURED_EVENTS: 1,
	MAX_FEATURED_EVENTS_LIMIT: 10,
	MIN_FEATURE_DURATION_HOURS: 1,
	MAX_FEATURE_DURATION_HOURS: 168, // 1 week
	MIN_FEATURE_PRICE: 0,
	MAX_FEATURE_PRICE: 1000,
} as const;

export type FeaturedEventsConfig = typeof FEATURED_EVENTS_CONFIG;
