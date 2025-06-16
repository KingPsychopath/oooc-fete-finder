/**
 * Data processing utilities
 * Handles CSV parsing and event data conversion
 */

import { GoogleCloudAPI } from "@/lib/google/api";
import { Event } from "@/types/events";
import { parseCSVContent } from "./csv/parser";
import { EventCoordinatePopulator } from "./event-coordinate-populator";
import { assembleEvent } from "./events/event-assembler";
import {
	type DateFormatWarning,
	WarningSystem,
} from "./validation/date-warnings";

export interface ProcessedDataResult {
	events: Event[];
	count: number;
	source: "local" | "remote";
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
	source: "local" | "remote",
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

	console.log("🔄 Parsing CSV content...");

	// Clear any previous transformation warnings
	WarningSystem.clearDateFormatWarnings();

	try {
		// Parse CSV content
		const csvRows = parseCSVContent(csvContent);
		let events: Event[] = csvRows.map((row, index) =>
			assembleEvent(row, index),
		);

		// Collect transformation warnings
		const transformationWarnings = WarningSystem.getDateFormatWarnings();
		if (transformationWarnings.length > 0) {
			console.log(
				`📊 Collected ${transformationWarnings.length} transformation warnings`,
			);
		}

		// Check if remote source returned 0 events and fall back to local CSV
		if (events.length === 0 && source === "remote" && enableLocalFallback) {
			console.warn(
				"⚠️ Remote source returned 0 events, attempting fallback to local CSV...",
			);

			try {
				const { fetchLocalCSV } = await import("./csv/fetcher");
				const localCsvContent = await fetchLocalCSV();

				// Clear warnings before processing local data
				WarningSystem.clearDateFormatWarnings();

				const localCsvRows = parseCSVContent(localCsvContent);
				const localEvents = localCsvRows.map((row, index) =>
					assembleEvent(row, index),
				);

				if (localEvents.length > 0) {
					events = localEvents;
					source = "local";
					console.log(
						`✅ Successfully fell back to local CSV with ${localEvents.length} events`,
					);
					errors.push("Remote returned 0 events - used local CSV fallback");

					// Update warnings with local data warnings
					const localWarnings = WarningSystem.getDateFormatWarnings();
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

		// Determine if coordinate population should be enabled
		// Default: true for remote sources (where API access is available), false for local
		// TEMPORARY: Disabled for performance testing
		const shouldPopulateCoordinates =
			options.populateCoordinates !== undefined
				? options.populateCoordinates
				: false; // Temporarily disabled: source === "remote";

		console.log(
			`🗺️ Coordinate population for ${source} source: ${shouldPopulateCoordinates ? "ENABLED" : "DISABLED"}${options.populateCoordinates !== undefined ? " (manually overridden)" : " (automatic)"}`,
		);

		let coordinatesPopulated = false;
		let coordinatesCount = 0;

		if (shouldPopulateCoordinates && GoogleCloudAPI.supportsGeocoding()) {
			try {
				console.log("🗺️ Populating event coordinates...");
				console.log(`📊 Starting with ${events.length} events`);

				// Log a sample of events before geocoding
				console.log("📋 Sample events before geocoding:");
				events.slice(0, 3).forEach((event, index) => {
					console.log(
						`   ${index + 1}. "${event.name}" - Location: "${event.location}", Arrondissement: ${event.arrondissement}, Has Coordinates: ${!!event.coordinates}`,
					);
				});

				const eventsWithCoords =
					await EventCoordinatePopulator.populateCoordinates(events, {
						batchSize: options.coordinateBatchSize || 5,
						onProgress: options.onCoordinateProgress,
						onError: (error, event) => {
							console.warn(
								`⚠️ Failed to geocode "${event.name}": ${error.message}`,
							);
						},
						fallbackToArrondissement: true,
					});

				events = eventsWithCoords;
				coordinatesCount = events.filter((e) => e.coordinates).length;
				coordinatesPopulated = true;

				console.log(
					`✅ Populated coordinates for ${coordinatesCount}/${events.length} events`,
				);

				// Log detailed results
				console.log("📍 Coordinate population results:");
				events.forEach((event, index) => {
					if (event.coordinates) {
						console.log(
							`   ✅ ${index + 1}. "${event.name}" (${event.location}) → lat: ${event.coordinates.lat}, lng: ${event.coordinates.lng}`,
						);
					} else {
						console.log(
							`   ❌ ${index + 1}. "${event.name}" (${event.location}) → No coordinates`,
						);
					}
				});

				// Log complete event objects for first few events
				console.log("🔍 Complete Event Objects (first 3 with coordinates):");
				const eventsWithCoordinates = events
					.filter((e) => e.coordinates)
					.slice(0, 3);
				eventsWithCoordinates.forEach((event, index) => {
					console.log(`Event ${index + 1}:`, JSON.stringify(event, null, 2));
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				console.warn(`⚠️ Coordinate population failed: ${errorMessage}`);
				errors.push(`Coordinate population failed: ${errorMessage}`);
			}
		} else if (
			shouldPopulateCoordinates &&
			!GoogleCloudAPI.supportsGeocoding()
		) {
			console.log(
				"⚠️ Coordinate population requested but service account not configured",
			);
			errors.push(
				"Coordinate population requested but Google Cloud service account not configured",
			);
		} else if (!shouldPopulateCoordinates) {
			console.log(
				`📍 Coordinate population skipped for ${source} source (${events.length} events)`,
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
		console.error("❌ Error processing CSV data:", errorMessage);

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
