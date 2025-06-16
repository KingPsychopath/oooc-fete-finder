/**
 * Event Data Validation
 *
 * Pure validation functions for event data quality and correctness.
 * Separated from transformation logic for better maintainability.
 */

import type { Event } from "@/types/events";

/**
 * Validate if events data is considered valid for caching
 * Returns true if data is valid, false if it should be considered invalid
 */
export function isValidEventsData(events: Event[] | null | undefined): boolean {
	// Check for null, undefined, or empty array
	if (!events || !Array.isArray(events) || events.length === 0) {
		return false;
	}

	// Check if events have required fields (basic validation)
	// At least 80% of events should have valid required fields
	const validEvents = events.filter(
		(event) =>
			event &&
			typeof event.id === "string" &&
			event.id.trim() !== "" &&
			typeof event.name === "string" &&
			event.name.trim() !== "" &&
			typeof event.date === "string" &&
			event.date.trim() !== "",
	);

	const validPercentage = validEvents.length / events.length;
	const isValid = validPercentage >= 0.8; // At least 80% should be valid

	if (!isValid) {
		console.log(
			`⚠️ Data validation failed: ${validEvents.length}/${events.length} events are valid (${Math.round(validPercentage * 100)}%)`,
		);
		// Log a few invalid events for debugging
		const invalidEvents = events.filter(
			(event) => !validEvents.includes(event),
		);
		console.log(
			"📋 Sample invalid events:",
			invalidEvents.slice(0, 3).map((e) => ({
				id: e?.id,
				name: e?.name,
				date: e?.date,
				hasRequiredFields: {
					id: typeof e?.id === "string" && e?.id.trim() !== "",
					name: typeof e?.name === "string" && e?.name.trim() !== "",
					date: typeof e?.date === "string" && e?.date.trim() !== "",
				},
			})),
		);
	}

	return isValid;
}

/**
 * Validate individual event object
 */
export function validateEvent(event: Event): {
	isValid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Required field validation
	if (!event.id || typeof event.id !== "string" || event.id.trim() === "") {
		errors.push("Event ID is required and must be a non-empty string");
	}

	if (
		!event.name ||
		typeof event.name !== "string" ||
		event.name.trim() === ""
	) {
		errors.push("Event name is required and must be a non-empty string");
	}

	if (
		!event.date ||
		typeof event.date !== "string" ||
		event.date.trim() === ""
	) {
		errors.push("Event date is required and must be a non-empty string");
	}

	// Warning-level validation
	if (!event.location || event.location === "TBA") {
		warnings.push("Event location is missing or TBA");
	}

	if (!event.time) {
		warnings.push("Event time is missing");
	}

	if (!event.description) {
		warnings.push("Event description is missing");
	}

	if (event.price && typeof event.price !== "string") {
		warnings.push("Event price should be a string");
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate event array for common issues
 */
export function validateEventArray(events: Event[]): {
	isValid: boolean;
	duplicateIds: string[];
	invalidEvents: Array<{ index: number; event: Event; errors: string[] }>;
	totalIssues: number;
} {
	// Check for duplicate IDs
	const idCounts = new Map<string, number>();
	const duplicateIds: string[] = [];

	events.forEach((event) => {
		if (event.id) {
			const currentCount = idCounts.get(event.id) || 0;
			idCounts.set(event.id, currentCount + 1);

			if (currentCount === 1) {
				duplicateIds.push(event.id);
			}
		}
	});

	// Validate individual events
	const invalidEvents: Array<{
		index: number;
		event: Event;
		errors: string[];
	}> = [];

	events.forEach((event, index) => {
		const validation = validateEvent(event);
		if (!validation.isValid) {
			invalidEvents.push({
				index,
				event,
				errors: validation.errors,
			});
		}
	});

	const totalIssues = duplicateIds.length + invalidEvents.length;

	return {
		isValid: totalIssues === 0,
		duplicateIds,
		invalidEvents,
		totalIssues,
	};
}
