import type { Event, ParisArrondissement } from "@/features/events/types";
import { log } from "@/lib/platform/logger";
import {
	type CoordinateResult,
	CoordinateService,
	type GeocodingError,
	isCoordinateResolvableInput,
	resetGeocodingRunState,
} from "./coordinate-service";
import { LocationStorage } from "./location-storage";

/**
 * Options for coordinate population
 */
export type PopulateCoordinatesOptions = {
	batchSize?: number;
	onProgress?: (processed: number, total: number, current: Event) => void;
	onError?: (error: GeocodingError, event: Event) => void;
	fallbackToArrondissement?: boolean;
	forceRefresh?: boolean;
};

/**
 * Event Coordinate Populator - Efficiently processes multiple events
 *
 * Optimized flow:
 * 1. Load storage ONCE at start
 * 2. Process all events in memory
 * 3. Save storage ONCE at end
 */
export class EventCoordinatePopulator {
	/**
	 * Populate coordinates for multiple events efficiently
	 */
	static async populateCoordinates(
		events: Event[],
		options: PopulateCoordinatesOptions = {},
	): Promise<Event[]> {
		const {
			batchSize = 2, // Reduced from 5 to avoid overwhelming the API
			onProgress,
			onError,
			fallbackToArrondissement = true,
			forceRefresh = false,
		} = options;

		resetGeocodingRunState();
		const storedLocations = await LocationStorage.load();
		const initialWithCoords = events.filter((e) => e.coordinates).length;
		const initialWithoutCoords = events.length - initialWithCoords;

		let storageHits = 0;
		let apiCalls = 0;
		let fallbacks = 0;
		let invalidInputSkips = 0;

		// 2. PROCESS ALL EVENTS IN MEMORY
		const eventsWithCoords: Event[] = [];
		const batches: Event[][] = [];

		// Split events into batches for rate limiting
		for (let i = 0; i < events.length; i += batchSize) {
			batches.push(events.slice(i, i + batchSize));
		}

		let processed = 0;

		for (const batch of batches) {
			const apiCallsBeforeBatch = apiCalls;
			const batchPromises = batch.map(async (event) => {
				try {
					// Skip if event already has coordinates
					if (event.coordinates) {
						processed++;
						onProgress?.(processed, events.length, event);
						return { ...event };
					}

					if (
						!isCoordinateResolvableInput(
							event.location || "",
							event.arrondissement,
						)
					) {
						invalidInputSkips++;
						processed++;
						onProgress?.(processed, events.length, event);
						return { ...event };
					}

					// Get coordinates using the coordinate service
					const result: CoordinateResult | null =
						await CoordinateService.getCoordinates(
							event.location || "",
							event.arrondissement,
							storedLocations,
							{ fallbackToArrondissement, forceRefresh },
						);

					// Track statistics
					if (result) {
						if (result.wasInStorage) {
							storageHits++;
						} else if (result.source === "geocoded") {
							apiCalls++;
						} else if (result.source === "estimated") {
							fallbacks++;
						}
					}

					processed++;
					onProgress?.(processed, events.length, event);

					// Add coordinates to event
					if (result) {
						return {
							...event,
							coordinates: result.coordinates,
						};
					}

					return { ...event };
				} catch (error) {
					const geocodingError = error as GeocodingError;
					onError?.(geocodingError, event);

					processed++;
					onProgress?.(processed, events.length, event);

					return { ...event };
				}
			});

			// Process batch concurrently
			const batchResults = await Promise.all(batchPromises);
			eventsWithCoords.push(...batchResults);

			// Delay only when we actually called external geocoding API in this batch.
			// If we're serving from storage or arrondissement fallback, avoid artificial waits.
			const usedApiInBatch = apiCalls > apiCallsBeforeBatch;
			if (usedApiInBatch && batch !== batches[batches.length - 1]) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		if (apiCalls > 0 || fallbacks > 0) {
			try {
				await LocationStorage.save(storedLocations);
			} catch (error) {
				log.error(
					"coordinates",
					"Failed to save location storage",
					undefined,
					error,
				);
			}
		}

		const coordCount = eventsWithCoords.filter((e) => e.coordinates).length;
		const unresolved = eventsWithCoords.filter((e) => !e.coordinates).length;
		const resolvedDuringRun = Math.max(0, coordCount - initialWithCoords);
		const unresolvedAfterLookup = Math.max(0, unresolved - invalidInputSkips);

		log.info("coordinates", "Coordinate population done", {
			totalEvents: events.length,
			withCoords: coordCount,
			withoutCoords: unresolved,
			initialWithCoords,
			initialWithoutCoords,
			resolvedDuringRun,
			fromCache: storageHits,
			geocodedFresh: apiCalls,
			arrondissementFallback: fallbacks,
			skippedInvalidInput: invalidInputSkips,
			unresolvedAfterLookup,
		});

		return eventsWithCoords;
	}

	/**
	 * Clear all stored locations
	 */
	static async clearStorage(): Promise<void> {
		await LocationStorage.clear();
		log.info("coordinates", "Location storage cleared");
	}

	/**
	 * Get storage statistics
	 */
	static async getStorageStats() {
		const storedLocations = await LocationStorage.load();
		return CoordinateService.getStats(storedLocations);
	}

	/**
	 * Get all stored locations
	 */
	static async getStoredLocations() {
		const storedLocations = await LocationStorage.load();
		return Array.from(storedLocations.values());
	}

	/**
	 * Set manual location coordinates
	 */
	static async setManualLocation(
		locationName: string,
		arrondissement: number | "unknown",
		coordinates: { lat: number; lng: number },
		confidence: number = 1.0,
	): Promise<void> {
		const storedLocations = await LocationStorage.load();

		CoordinateService.setManualCoordinates(
			locationName,
			arrondissement as ParisArrondissement,
			coordinates,
			storedLocations,
			confidence,
		);

		await LocationStorage.save(storedLocations);
		log.info("coordinates", "Manual location set", {
			location: locationName,
			lat: coordinates.lat,
			lng: coordinates.lng,
		});
	}
}
