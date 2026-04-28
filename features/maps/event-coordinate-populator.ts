import type { Event, ParisArrondissement } from "@/features/events/types";
import { LocationRepository } from "@/features/locations/location-repository";
import { LocationResolver } from "@/features/locations/location-resolver";
import {
	generateLocationStorageKey,
	isCoordinateResolvableInput,
} from "@/features/locations/location-utils";
import type {
	LocationResolution,
	StoredLocationResolution,
} from "@/features/locations/types";
import { log } from "@/lib/platform/logger";
import {
	CoordinateService,
	type GeocodingError,
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
	static async hydrateStoredCoordinates(events: Event[]): Promise<Event[]> {
		const storedLocations = await LocationRepository.load();
		if (storedLocations.size === 0) {
			return events.map((event) => ({ ...event }));
		}

		return events.map((event) => {
			if (event.coordinates) {
				return { ...event };
			}
			if (
				!isCoordinateResolvableInput(event.location || "", event.arrondissement)
			) {
				return { ...event };
			}

			const storageKey = generateLocationStorageKey(
				event.location || "",
				event.arrondissement,
			);
			const stored = storedLocations.get(storageKey);
			if (!stored?.coordinates) {
				return { ...event };
			}

			const resolution: LocationResolution = {
				coordinates: stored.coordinates,
				source: stored.source,
				precision: stored.precision,
				confidence: stored.confidence,
				formattedAddress: stored.formattedAddress,
				provider: stored.provider,
				providerPlaceId: stored.providerPlaceId,
				query: stored.query,
				lastResolvedAt: stored.lastResolvedAt,
			};

			return {
				...event,
				coordinates: stored.coordinates,
				locationResolution: resolution,
			};
		});
	}

	static async pruneStorageToEvents(events: Event[]): Promise<{
		beforeCount: number;
		afterCount: number;
		removedCount: number;
	}> {
		const storedLocations = await LocationStorage.load();
		const beforeCount = storedLocations.size;
		if (beforeCount === 0) {
			return { beforeCount: 0, afterCount: 0, removedCount: 0 };
		}

		const activeKeys = new Set<string>();
		for (const event of events) {
			const location = event.location || "";
			if (!isCoordinateResolvableInput(location, event.arrondissement)) {
				continue;
			}
			activeKeys.add(
				generateLocationStorageKey(location, event.arrondissement),
			);
		}

		for (const key of Array.from(storedLocations.keys())) {
			if (!activeKeys.has(key)) {
				storedLocations.delete(key);
			}
		}

		const afterCount = storedLocations.size;
		const removedCount = Math.max(0, beforeCount - afterCount);
		if (removedCount > 0) {
			await LocationStorage.save(storedLocations);
		}

		return { beforeCount, afterCount, removedCount };
	}

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
		const storedLocations = await LocationRepository.load();
		const resolver = new LocationResolver();
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
					const storageKey = generateLocationStorageKey(
						event.location || "",
						event.arrondissement,
					);
					const hadStoredLocation = storedLocations.has(storageKey);
					const result = await resolver.resolve(
						{
							locationName: event.location || "",
							arrondissement: event.arrondissement,
						},
						storedLocations,
						{
							allowProviderLookup: true,
							allowArrondissementFallback: fallbackToArrondissement,
							forceRefresh,
						},
					);

					// Track statistics
					if (result.coordinates) {
						if (hadStoredLocation && !forceRefresh) {
							storageHits++;
						} else if (result.source === "geocoded") {
							apiCalls++;
						} else if (result.source === "estimated_arrondissement") {
							fallbacks++;
						}
					}

					processed++;
					onProgress?.(processed, events.length, event);

					// Add coordinates to event
					if (result.coordinates) {
						return {
							...event,
							coordinates: result.coordinates,
							locationResolution: result,
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
				await LocationRepository.save(storedLocations);
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

	static async getStoredLocationResolutions(): Promise<
		StoredLocationResolution[]
	> {
		const storedLocations = await LocationRepository.load();
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

	static async removeStoredLocation(
		locationName: string,
		arrondissement: ParisArrondissement,
	): Promise<boolean> {
		const storedLocations = await LocationRepository.load();
		const storageKey = generateLocationStorageKey(locationName, arrondissement);
		const removed = storedLocations.delete(storageKey);
		if (removed) {
			await LocationRepository.save(storedLocations);
			log.info("coordinates", "Stored location removed", {
				location: locationName,
				arrondissement,
			});
		}
		return removed;
	}
}
