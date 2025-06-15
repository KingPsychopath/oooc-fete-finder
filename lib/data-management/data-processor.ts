/**
 * Data processing utilities
 * Handles CSV parsing and event data conversion
 */

import { parseCSVContent } from "@/utils/csv-parser";
import { convertCSVRowToEvent, clearDateFormatWarnings, getDateFormatWarnings, type DateFormatWarning } from "./event-transformer";
import { Event } from "@/types/events";

export interface ProcessedDataResult {
	events: Event[];
	count: number;
	source: "local" | "remote";
	errors: string[];
	warnings: DateFormatWarning[];
}

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
 * Enhanced event quality checks
 */
export function performEventQualityChecks(events: Event[]): {
	qualityScore: number;
	issues: string[];
	recommendations: string[];
} {
	const issues: string[] = [];
	const recommendations: string[] = [];
	
	// Check for missing locations
	const eventsWithoutLocation = events.filter(event => !event.location || event.location === "TBA");
	if (eventsWithoutLocation.length > 0) {
		issues.push(`${eventsWithoutLocation.length} events missing location information`);
		recommendations.push("Consider adding venue/location details for better user experience");
	}
	
	// Check for missing times
	const eventsWithoutTime = events.filter(event => !event.time);
	if (eventsWithoutTime.length > 0) {
		issues.push(`${eventsWithoutTime.length} events missing start time`);
		recommendations.push("Add specific start times to help users plan their attendance");
	}
	
	// Check for generic event names
	const genericEvents = events.filter(event => 
		event.name.includes("Event ") || 
		event.name.toLowerCase() === "tba" ||
		event.name.toLowerCase() === "tbc"
	);
	if (genericEvents.length > 0) {
		issues.push(`${genericEvents.length} events have generic/placeholder names`);
		recommendations.push("Update event names to be more descriptive and engaging");
	}
	
	// Check for missing descriptions
	const eventsWithoutDescription = events.filter(event => !event.description);
	if (eventsWithoutDescription.length > 0) {
		issues.push(`${eventsWithoutDescription.length} events missing descriptions`);
		recommendations.push("Add event descriptions to provide more context to users");
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

/**
 * Process CSV content into Event objects with fallback logic and enhanced validation
 */
export async function processCSVData(
	csvContent: string,
	source: "local" | "remote",
	enableLocalFallback: boolean = true,
): Promise<ProcessedDataResult> {
	const errors: string[] = [];

	console.log("🔄 Parsing CSV content...");

	// Clear any previous transformation warnings
	clearDateFormatWarnings();

	try {
		// Parse CSV content
		const csvRows = parseCSVContent(csvContent);
		let events: Event[] = csvRows.map((row, index) =>
			convertCSVRowToEvent(row, index),
		);

		// Collect transformation warnings
		const transformationWarnings = getDateFormatWarnings();
		if (transformationWarnings.length > 0) {
			console.log(`📊 Collected ${transformationWarnings.length} transformation warnings`);
		}

		// Check if remote source returned 0 events and fall back to local CSV
		if (events.length === 0 && source === "remote" && enableLocalFallback) {
			console.warn(
				"⚠️ Remote source returned 0 events, attempting fallback to local CSV...",
			);

			try {
				const { fetchLocalCSV } = await import("./csv-fetcher");
				const localCsvContent = await fetchLocalCSV();
				
				// Clear warnings before processing local data
				clearDateFormatWarnings();
				
				const localCsvRows = parseCSVContent(localCsvContent);
				const localEvents = localCsvRows.map((row, index) =>
					convertCSVRowToEvent(row, index),
				);

				if (localEvents.length > 0) {
					events = localEvents;
					source = "local";
					console.log(
						`✅ Successfully fell back to local CSV with ${localEvents.length} events`,
					);
					errors.push("Remote returned 0 events - used local CSV fallback");
					
					// Update warnings with local data warnings
					const localWarnings = getDateFormatWarnings();
					transformationWarnings.length = 0;
					transformationWarnings.push(...localWarnings);
				} else {
					console.log(
						"ℹ️ Local CSV also has 0 events, proceeding with empty state",
					);
					errors.push("Both remote and local CSV contain 0 events");
				}
			} catch (localError) {
				const localErrorMsg =
					localError instanceof Error ? localError.message : "Unknown error";
				console.log(
					`⚠️ Local CSV fallback failed: ${localErrorMsg}, proceeding with 0 events from remote`,
				);
				errors.push(
					`Remote returned 0 events, local CSV fallback failed: ${localErrorMsg}`,
				);
			}
		}

		// Perform quality checks
		const qualityCheck = performEventQualityChecks(events);
		if (qualityCheck.issues.length > 0) {
			console.log(`📊 Data quality score: ${qualityCheck.qualityScore}%`);
			console.log("📋 Quality issues:", qualityCheck.issues);
			if (qualityCheck.recommendations.length > 0) {
				console.log("💡 Recommendations:", qualityCheck.recommendations);
			}
		}

		return {
			events,
			count: events.length,
			source,
			errors,
			warnings: transformationWarnings,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Error processing CSV data:", errorMessage);

		return {
			events: [],
			count: 0,
			source,
			errors: [errorMessage],
			warnings: getDateFormatWarnings(),
		};
	}
}
