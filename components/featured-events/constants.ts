// Constants for FeaturedEvents configuration
export const FEATURED_EVENTS_CONFIG = {
	// Maximum number of featured events to show
	MAX_FEATURED_EVENTS: 3,
	
	// Duration in hours that events are featured for
	FEATURE_DURATION_HOURS: 48,
	
	// Pricing for featuring an event (in euros)
	FEATURE_PRICE: 25,
	
	// CTA message for event hosts
	CTA_MESSAGE: "Get noticed by thousands more by featuring your event →",
	
	// Feature page route
	FEATURE_PAGE_ROUTE: "/feature-event",
} as const;

export type FeaturedEventsConfig = typeof FEATURED_EVENTS_CONFIG; 