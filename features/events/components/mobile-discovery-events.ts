"use client";

export const MOBILE_DISCOVERY_SEARCH_EVENT = "oooc:mobile-discovery-search";
export const MOBILE_DISCOVERY_FILTER_EVENT = "oooc:mobile-discovery-filter";
export const MOBILE_DISCOVERY_STATE_EVENT = "oooc:mobile-discovery-state";
export const MOBILE_DISCOVERY_PENDING_ACTION_KEY =
	"oooc_mobile_discovery_pending_action";

export type MobileDiscoveryPendingAction = "search" | "filter";

export type MobileDiscoverySearchDetail = {
	behavior?: ScrollBehavior;
	query?: string;
	shouldFocus?: boolean;
};

export type MobileDiscoveryStateDetail = {
	activeFilterCount: number;
	hasActiveFilters: boolean;
	isAvailable: boolean;
	query: string;
	resultsCount: number;
};
