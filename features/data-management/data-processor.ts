/**
 * Data processing utilities
 * Handles CSV parsing and event data conversion
 */

import { Event } from "@/features/events/types";
import { EventCoordinatePopulator } from "@/features/maps/event-coordinate-populator";
import { GoogleCloudAPI } from "@/lib/google/api";
import { log } from "@/lib/platform/logger";
import { assembleEvent } from "./assembly/event-assembler";
import { ensureUniqueEventKeys } from "./assembly/event-key";
import { parseCSVContent } from "./csv/parser";
import {
	type DateFormatWarning,
	WarningSystem,
} from "./validation/date-warnings";

export interface ProcessedDataResult {
	events: Event[];
	count: number;
	source: "local" | "remote" | "store";
	errors: string[];
	warnings: DateFormatWarning[];
	coordinatesPopulated?: boolean; // Indicates if coordinates were populated
	coordinatesCount?: number; // Number of events with coordinates
}

// Import validation functions from focused module
import { isValidEventsData } from "./validation/event-validation";
import { performEventQualityChecks } from "./validation/quality-checks";

// Re-export for backwards compatibility
export { isValidEventsData, performEventQualityChecks };

/**
 * Process CSV content into Event objects with fallback logic and enhanced validation
 *
 * Coordinate population behavior:
 * - REMOTE sources: Automatically enabled (requires Google Cloud service account)
 * - LOCAL sources: Automatically disabled (no API access needed)
 * - Override with options.populateCoordinates: true/false
 *
 * Examples:
 * - processCSVData(csv, "remote") // Auto-geocodes remote data
 * - processCSVData(csv, "local")  // Skips geocoding for local data
 * - processCSVData(csv, "local", true, { populateCoordinates: true }) // Force geocoding for local
 */
export async function processCSVData(
	csvContent: string,
	source: "local" | "remote" | "store",
	enableLocalFallback: boolean = true,
	options: {
		populateCoordinates?: boolean; // Override coordinate population (defaults to true for remote, false for local)
		coordinateBatchSize?: number;
		onCoordinateProgress?: (
			processed: number,
			total: number,
			current: Event,
		) => void;
	} = {},
): Promise<ProcessedDataResult> {
	const errors: string[] = [];

	// Clear any previous transformation warnings
	WarningSystem.clearDateFormatWarnings();

	try {
		// Parse CSV content
		const csvRows = parseCSVContent(csvContent);
		const keyedRows = ensureUniqueEventKeys(csvRows);
		let events: Event[] = keyedRows.rows.map((row, index) =>
			assembleEvent(row, index),
		);
		log.info("data", "Event key hydration", {
			source,
			missingEventKeyCount: keyedRows.missingEventKeyCount,
			generatedEventKeyCount: keyedRows.generatedEventKeyCount,
		});

		const transformationWarnings = WarningSystem.getDateFormatWarnings();

		// Check if remote source returned 0 events and fall back to local CSV
		if (events.length === 0 && source === "remote" && enableLocalFallback) {
			log.warn(
				"data",
				"Remote source returned 0 events, attempting local fallback",
			);

			try {
				const { fetchLocalCSV } = await import("./csv/fetcher");
				const localCsvContent = await fetchLocalCSV();

				// Clear warnings before processing local data
				WarningSystem.clearDateFormatWarnings();

				const localCsvRows = parseCSVContent(localCsvContent);
				const keyedLocalRows = ensureUniqueEventKeys(localCsvRows);
				const localEvents = keyedLocalRows.rows.map((row, index) =>
					assembleEvent(row, index),
				);
				log.info("data", "Event key hydration", {
					source: "local-fallback",
					missingEventKeyCount: keyedLocalRows.missingEventKeyCount,
					generatedEventKeyCount: keyedLocalRows.generatedEventKeyCount,
				});

				if (localEvents.length > 0) {
					events = localEvents;
					source = "local";
					log.info("data", "Fell back to local CSV", {
						eventCount: localEvents.length,
					});
					errors.push("Remote returned 0 events - used local CSV fallback");

					// Update warnings with local data warnings
					const localWarnings = WarningSystem.getDateFormatWarnings();
					transformationWarnings.length = 0;
					transformationWarnings.push(...localWarnings);
				} else {
					log.info(
						"data",
						"Local CSV also returned 0 events, keeping empty state",
					);
					errors.push("Both remote and local CSV contain 0 events");
				}
			} catch (localError) {
				const localErrorMsg =
					localError instanceof Error ? localError.message : "Unknown error";
				log.warn(
					"data",
					"Local CSV fallback failed, keeping remote empty state",
					{
						error: localErrorMsg,
					},
				);
				errors.push(
					`Remote returned 0 events, local CSV fallback failed: ${localErrorMsg}`,
				);
			}
		}

		const qualityCheck = performEventQualityChecks(events);
		if (qualityCheck.issues.length > 0) {
			log.info("data", "Quality check", {
				score: qualityCheck.qualityScore,
				issueBuckets: qualityCheck.issues.length,
				issueCounts: qualityCheck.issueCounts,
				totalEvents: events.length,
				details: qualityCheck.issues,
			});
		} else {
			log.info("data", "Quality check", {
				score: qualityCheck.qualityScore,
				issueBuckets: 0,
				issueCounts: qualityCheck.issueCounts,
				totalEvents: events.length,
			});
		}

		// Determine if coordinate population should be enabled
		// Default: true for remote (API available), false for local/store (avoid geocoding on every read)
		const defaultPopulate = source === "remote";
		const shouldPopulateCoordinates =
			options.populateCoordinates !== undefined
				? options.populateCoordinates
				: defaultPopulate;

		log.info("data", "Coordinate population", {
			source,
			enabled: shouldPopulateCoordinates,
			defaultEnabledForSource: defaultPopulate,
			geocodingConfigured: GoogleCloudAPI.supportsGeocoding(),
		});

		let coordinatesPopulated = false;
		let coordinatesCount = 0;

		if (shouldPopulateCoordinates && GoogleCloudAPI.supportsGeocoding()) {
			try {
				const eventsWithCoords =
					await EventCoordinatePopulator.populateCoordinates(events, {
						batchSize: options.coordinateBatchSize || 5,
						onProgress: options.onCoordinateProgress,
						onError: (_error, _event) => {},
						fallbackToArrondissement: true,
					});

				events = eventsWithCoords;
				coordinatesCount = events.filter((e) => e.coordinates).length;
				coordinatesPopulated = true;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				log.warn("data", "Coordinate population failed", {
					error: errorMessage,
				});
				errors.push(`Coordinate population failed: ${errorMessage}`);
			}
		} else if (
			shouldPopulateCoordinates &&
			!GoogleCloudAPI.supportsGeocoding()
		) {
			log.warn(
				"data",
				"GOOGLE_MAPS_API_KEY not set — enable Geocoding API for address lookup",
			);
			errors.push(
				"Coordinate population requested but GOOGLE_MAPS_API_KEY not set (required for geocoding)",
			);
		}

		return {
			events,
			count: events.length,
			source,
			errors,
			warnings: transformationWarnings,
			coordinatesPopulated,
			coordinatesCount,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		log.error("data", "CSV processing failed", undefined, error);

		return {
			events: [],
			count: 0,
			source,
			errors: [errorMessage],
			warnings: WarningSystem.getDateFormatWarnings(),
			coordinatesPopulated: false,
			coordinatesCount: 0,
		};
	}
}
