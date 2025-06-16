/**
 * Event Quality Checks
 *
 * Provides functions to analyze and score the quality of event data.
 * Focuses on data completeness and user experience factors.
 */

import type { Event } from "@/types/events";

/**
 * Enhanced event quality checks
 * Analyzes events for completeness and quality issues
 */
export function performEventQualityChecks(events: Event[]): {
	qualityScore: number;
	issues: string[];
	recommendations: string[];
} {
	const issues: string[] = [];
	const recommendations: string[] = [];

	// Check for missing locations
	const eventsWithoutLocation = events.filter(
		(event) => !event.location || event.location === "TBA",
	);
	if (eventsWithoutLocation.length > 0) {
		issues.push(
			`${eventsWithoutLocation.length} events missing location information`,
		);
		recommendations.push(
			"Consider adding venue/location details for better user experience",
		);
	}

	// Check for missing times
	const eventsWithoutTime = events.filter((event) => !event.time);
	if (eventsWithoutTime.length > 0) {
		issues.push(`${eventsWithoutTime.length} events missing start time`);
		recommendations.push(
			"Add specific start times to help users plan their attendance",
		);
	}

	// Check for generic event names
	const genericEvents = events.filter(
		(event) =>
			event.name.includes("Event ") ||
			event.name.toLowerCase() === "tba" ||
			event.name.toLowerCase() === "tbc",
	);
	if (genericEvents.length > 0) {
		issues.push(
			`${genericEvents.length} events have generic/placeholder names`,
		);
		recommendations.push(
			"Update event names to be more descriptive and engaging",
		);
	}

	// Check for missing descriptions
	const eventsWithoutDescription = events.filter((event) => !event.description);
	if (eventsWithoutDescription.length > 0) {
		issues.push(
			`${eventsWithoutDescription.length} events missing descriptions`,
		);
		recommendations.push(
			"Add event descriptions to provide more context to users",
		);
	}

	// Calculate quality score (0-100)
	const totalChecks = 4;
	const issueWeight = issues.length / totalChecks;
	const qualityScore = Math.max(0, Math.round((1 - issueWeight) * 100));

	return {
		qualityScore,
		issues,
		recommendations,
	};
}
