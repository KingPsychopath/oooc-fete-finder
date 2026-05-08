"use client";

import type { DateRangeFilter } from "@/features/events/filtering";
import type { Event } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import { useMemo } from "react";
import { FEATURED_EVENTS_CONFIG, FEATURED_EVENTS_LIMITS } from "../constants";
import { selectFeaturedEvents } from "../selection";
import type { FeaturedEventSelectionResult } from "../types";

/**
 * Custom hook to select and manage featured events
 * - Automatically filters out expired timestamp-based featured events
 * - Permanently displays manually featured events without timestamps
 * - Uses deterministic shuffling to avoid hydration errors
 */
export function useFeaturedEvents(
	events: Event[],
	maxFeaturedEvents: number = FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS,
	dateRange: DateRangeFilter = { from: null, to: null },
): FeaturedEventSelectionResult {
	const result = useMemo(() => {
		// Input validation
		if (!Array.isArray(events)) {
			clientLog.warn("events.featured", "events must be an array");
			return {
				featuredEvents: [],
				totalEventsCount: 0,
				hasMoreEvents: false,
			};
		}

		const resolvedMaxFeaturedEvents =
			maxFeaturedEvents < FEATURED_EVENTS_LIMITS.MIN_FEATURED_EVENTS ||
			maxFeaturedEvents > FEATURED_EVENTS_LIMITS.MAX_FEATURED_EVENTS_LIMIT
				? FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS
				: maxFeaturedEvents;

		if (resolvedMaxFeaturedEvents !== maxFeaturedEvents) {
			clientLog.warn(
				"events.featured",
				"maxFeaturedEvents out of bounds; using default",
				{
					requested: maxFeaturedEvents,
					min: FEATURED_EVENTS_LIMITS.MIN_FEATURED_EVENTS,
					max: FEATURED_EVENTS_LIMITS.MAX_FEATURED_EVENTS_LIMIT,
				},
			);
		}

		// Handle empty events array
		if (events.length === 0) {
			return {
				featuredEvents: [],
				totalEventsCount: 0,
				hasMoreEvents: false,
			};
		}
		const featured = selectFeaturedEvents({
			events,
			maxFeaturedEvents: resolvedMaxFeaturedEvents,
			dateRange,
		});

		// Safety check: filter out any undefined events
		const safeFeatured = featured.filter((event) => event != null);

		// Debug logging if we have issues
		if (safeFeatured.length !== featured.length) {
			clientLog.warn(
				"events.featured",
				"Filtered undefined events in featured selection",
				{
					filteredCount: featured.length - safeFeatured.length,
				},
			);
		}

		return {
			featuredEvents: safeFeatured,
			totalEventsCount: events.length,
			hasMoreEvents: events.length > resolvedMaxFeaturedEvents,
		};
	}, [dateRange, events, maxFeaturedEvents]);

	return result;
}
