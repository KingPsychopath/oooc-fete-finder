/**
 * Data processing utilities
 * Handles CSV parsing and event data conversion
 */

import { parseCSVContent, convertCSVRowToEvent } from "@/utils/csvParser";
import { Event } from "@/types/events";

export interface ProcessedDataResult {
	events: Event[];
	count: number;
	source: 'local' | 'remote';
	errors: string[];
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
	const validEvents = events.filter(event => 
		event && 
		typeof event.id === 'string' && 
		event.id.trim() !== '' &&
		typeof event.name === 'string' && 
		event.name.trim() !== '' &&
		typeof event.date === 'string' &&
		event.date.trim() !== ''
	);

	const validPercentage = validEvents.length / events.length;
	const isValid = validPercentage >= 0.8; // At least 80% should be valid

	if (!isValid) {
		console.log(`⚠️ Data validation failed: ${validEvents.length}/${events.length} events are valid (${Math.round(validPercentage * 100)}%)`);
		// Log a few invalid events for debugging
		const invalidEvents = events.filter(event => !validEvents.includes(event));
		console.log("📋 Sample invalid events:", invalidEvents.slice(0, 3).map(e => ({
			id: e?.id,
			name: e?.name,
			date: e?.date,
			hasRequiredFields: {
				id: typeof e?.id === 'string' && e?.id.trim() !== '',
				name: typeof e?.name === 'string' && e?.name.trim() !== '',
				date: typeof e?.date === 'string' && e?.date.trim() !== ''
			}
		})));
	}

	return isValid;
}

/**
 * Process CSV content into Event objects with fallback logic
 */
export async function processCSVData(
	csvContent: string,
	source: 'local' | 'remote',
	enableLocalFallback: boolean = true
): Promise<ProcessedDataResult> {
	const errors: string[] = [];
	
	console.log("🔄 Parsing CSV content...");
	
	try {
		// Parse CSV content
		const csvRows = parseCSVContent(csvContent);
		let events: Event[] = csvRows.map((row, index) =>
			convertCSVRowToEvent(row, index),
		);

		// Check if remote source returned 0 events and fall back to local CSV
		if (events.length === 0 && source === "remote" && enableLocalFallback) {
			console.warn("⚠️ Remote source returned 0 events, attempting fallback to local CSV...");
			
			try {
				const { fetchLocalCSV } = await import('./csv-fetcher');
				const localCsvContent = await fetchLocalCSV();
				const localCsvRows = parseCSVContent(localCsvContent);
				const localEvents = localCsvRows.map((row, index) =>
					convertCSVRowToEvent(row, index),
				);
				
				if (localEvents.length > 0) {
					events = localEvents;
					source = "local";
					console.log(`✅ Successfully fell back to local CSV with ${localEvents.length} events`);
					errors.push("Remote returned 0 events - used local CSV fallback");
				} else {
					console.log("ℹ️ Local CSV also has 0 events, proceeding with empty state");
					errors.push("Both remote and local CSV contain 0 events");
				}
			} catch (localError) {
				const localErrorMsg = localError instanceof Error ? localError.message : "Unknown error";
				console.log(`⚠️ Local CSV fallback failed: ${localErrorMsg}, proceeding with 0 events from remote`);
				errors.push(`Remote returned 0 events, local CSV fallback failed: ${localErrorMsg}`);
			}
		}

		console.log(`✅ Successfully processed ${events.length} events from ${source} source`);

		return {
			events,
			count: events.length,
			source,
			errors,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Error processing CSV data:", errorMessage);
		
		return {
			events: [],
			count: 0,
			source,
			errors: [errorMessage],
		};
	}
} 