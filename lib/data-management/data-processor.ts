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