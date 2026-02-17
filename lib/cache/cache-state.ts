/**
 * Cache State Management
 * Handles in-memory cache state and operations
 */

import { log } from "@/lib/platform/logger";
import { Event } from "@/features/events/types";
import { getCacheManagerConfig } from "./cache-config";
import type { CacheState, CacheStateStatus, MemoryStats } from "./cache-types";

// Memory management configuration - uses cache config
const getMemoryConfig = () => {
	const config = getCacheManagerConfig();
	return {
		/** Maximum memory usage for cache in bytes (50MB default) */
		MAX_MEMORY_USAGE: config.maxMemoryUsage,

		/** Memory check interval in ms (5 minutes) */
		MEMORY_CHECK_INTERVAL: config.memoryCheckInterval,

		/** Cleanup threshold percentage (80% of max memory) */
		CLEANUP_THRESHOLD: config.cleanupThreshold,

		/** Emergency cleanup threshold (95% of max memory) */
		EMERGENCY_THRESHOLD: config.emergencyThreshold,
	} as const;
};

/**
 * Cache state - centralized in this module
 */
const cacheState: CacheState = {
	events: null,
	lastFetchTime: 0,
	lastRemoteFetchTime: 0,
	lastRemoteSuccessTime: 0,
	lastRemoteErrorMessage: "",
	lastDataSource: "cached",
	memoryUsage: 0,
	lastMemoryCheck: 0,
};

/**
 * Cache State Manager class
 */
export class CacheStateManager {
	/**
	 * Calculate approximate memory usage of cached data
	 */
	private static calculateMemoryUsage(events: Event[] | null): number {
		if (!events || events.length === 0) return 0;

		try {
			// Rough estimation: JSON.stringify size * 2 (for object overhead)
			const jsonSize = JSON.stringify(events).length;
			return jsonSize * 2;
		} catch (error) {
			console.warn(
				"⚠️ Failed to calculate memory usage, using fallback estimation:",
				error instanceof Error ? error.message : "Unknown error",
			);
			// Fallback: estimate ~2KB per event (conservative)
			return events.length * 2048;
		}
	}

	/**
	 * Check if memory usage is within limits
	 */
	private static checkMemoryLimits(): {
		withinLimits: boolean;
		needsCleanup: boolean;
		needsEmergencyCleanup: boolean;
		stats: MemoryStats;
	} {
		const now = Date.now();
		const currentUsage = cacheState.memoryUsage;
		const maxLimit = getMemoryConfig().MAX_MEMORY_USAGE;
		const utilizationPercent = (currentUsage / maxLimit) * 100;

		const stats: MemoryStats = {
			currentUsage,
			maxLimit,
			utilizationPercent,
			eventCount: cacheState.events?.length || 0,
			averageSizePerEvent: cacheState.events?.length
				? currentUsage / cacheState.events.length
				: 0,
		};

		const needsEmergencyCleanup =
			utilizationPercent > getMemoryConfig().EMERGENCY_THRESHOLD * 100;
		const needsCleanup =
			utilizationPercent > getMemoryConfig().CLEANUP_THRESHOLD * 100;
		const withinLimits = utilizationPercent < 100;

		const shouldLog =
			now - cacheState.lastMemoryCheck >
			getMemoryConfig().MEMORY_CHECK_INTERVAL;
		if (shouldLog || needsCleanup) {
			if (needsEmergencyCleanup) {
				log.warn("cache", "Memory usage critical", {
					usageMB: (currentUsage / 1024 / 1024).toFixed(2),
					limitMB: (maxLimit / 1024 / 1024).toFixed(2),
					percent: utilizationPercent.toFixed(1),
				});
			} else if (needsCleanup) {
				log.info("cache", "Memory cleanup recommended", {
					usageMB: (currentUsage / 1024 / 1024).toFixed(2),
					percent: utilizationPercent.toFixed(1),
				});
			}
		}

		// Update last memory check
		cacheState.lastMemoryCheck = now;

		return {
			withinLimits,
			needsCleanup,
			needsEmergencyCleanup,
			stats,
		};
	}

	/**
	 * Perform memory cleanup
	 */
	private static performMemoryCleanup(): void {
		if (!cacheState.events || cacheState.events.length === 0) return;

		const oldEventCount = cacheState.events.length;
		const oldMemoryMB = (cacheState.memoryUsage / 1024 / 1024).toFixed(2);
		this.clearCache();
		log.info("cache", "Memory cleanup completed", {
			eventsCleared: oldEventCount,
			memoryMB: oldMemoryMB,
		});
	}

	/**
	 * Get current cache state (read-only)
	 */
	static getState(): Readonly<CacheState> {
		return { ...cacheState };
	}

	/**
	 * Check if cache is valid (not expired)
	 */
	static isCacheValid(): boolean {
		if (!cacheState.events) return false;

		const now = Date.now();
		const config = getCacheManagerConfig();
		return now - cacheState.lastFetchTime < config.cacheDuration;
	}

	/**
	 * Check if it's time for a remote refresh
	 */
	static shouldRefreshRemote(): boolean {
		const now = Date.now();
		const config = getCacheManagerConfig();
		return now - cacheState.lastRemoteFetchTime > config.remoteRefreshInterval;
	}

	/**
	 * Update cache with new events data
	 */
	static updateCache(
		events: Event[],
		source: "remote" | "local" | "store" | "test",
		errorMessage?: string,
	): void {
		const now = Date.now();
		const previousFetchTime = cacheState.lastFetchTime;

		// Calculate memory usage before updating
		const newMemoryUsage = this.calculateMemoryUsage(events);

		// Check memory limits before accepting new data
		const tempMemoryUsage = cacheState.memoryUsage;
		cacheState.memoryUsage = newMemoryUsage;
		const memoryCheck = this.checkMemoryLimits();

		if (memoryCheck.needsEmergencyCleanup) {
			log.warn("cache", "Cache update would exceed memory limit, cleaning up", {
				requestedMB: (newMemoryUsage / 1024 / 1024).toFixed(2),
				limitMB: (getMemoryConfig().MAX_MEMORY_USAGE / 1024 / 1024).toFixed(
					2,
				),
			});
			cacheState.memoryUsage = tempMemoryUsage;
			this.performMemoryCleanup();
			cacheState.memoryUsage = newMemoryUsage;
			const recheckMemory = this.checkMemoryLimits();
			if (recheckMemory.needsEmergencyCleanup) {
				log.error("cache", "Still over memory limit after cleanup, rejecting");
				cacheState.memoryUsage = tempMemoryUsage;
				return;
			}
		}

		// Update cache data
		cacheState.events = events;
		cacheState.lastFetchTime = now;
		cacheState.lastDataSource = source;

		if (source === "remote") {
			cacheState.lastRemoteFetchTime = now;
			if (errorMessage) {
				cacheState.lastRemoteErrorMessage = errorMessage;
			} else {
				cacheState.lastRemoteSuccessTime = now;
				cacheState.lastRemoteErrorMessage = "";
			}
		}

		const memoryMB = (newMemoryUsage / 1024 / 1024).toFixed(2);
		const percent = (
			(newMemoryUsage / getMemoryConfig().MAX_MEMORY_USAGE) *
			100
		).toFixed(1);
		log.info("cache", "Cache updated", {
			events: events.length,
			source,
			memoryMB: `${memoryMB}MB`,
			usagePercent: `${percent}%`,
		});

		if (memoryCheck.needsCleanup && !memoryCheck.needsEmergencyCleanup) {
			log.info("cache", "Memory cleanup scheduled for next cycle");
		}
	}

	/**
	 * Get memory statistics
	 */
	static getMemoryStats(): MemoryStats {
		const memoryCheck = this.checkMemoryLimits();
		return memoryCheck.stats;
	}

	/**
	 * Update remote fetch attempt without changing cache data
	 */
	static updateRemoteAttempt(errorMessage: string): void {
		const now = Date.now();
		cacheState.lastRemoteFetchTime = now;
		cacheState.lastRemoteErrorMessage = errorMessage;
	}

	/**
	 * Refresh cache validity timer without updating the cached data
	 * Used when remote fetch fails but we want to keep serving existing cached data
	 *
	 * This implements resilient caching: when remote data is unavailable or invalid,
	 * we continue serving the previous cached data and refresh its validity timer
	 * to prevent it from expiring.
	 */
	static refreshCacheValidity(errorMessage?: string): void {
		if (!cacheState.events) return;

		const now = Date.now();
		const originalFetchTime = cacheState.lastFetchTime;
		const cacheAge = now - originalFetchTime;
		const config = getCacheManagerConfig();
		const MAX_CACHE_AGE = config.maxCacheAge;
		const EXTENSION_DURATION = config.cacheExtensionDuration;

		if (cacheAge < MAX_CACHE_AGE) {
			cacheState.lastFetchTime = now - (cacheAge - EXTENSION_DURATION);
		} else {
			cacheState.lastFetchTime = now;
			log.warn("cache", "Cache validity extended (data may be stale)", {
				ageMin: Math.round(cacheAge / 60000),
			});
		}

		cacheState.lastRemoteFetchTime = now;
		if (errorMessage) {
			cacheState.lastRemoteErrorMessage = errorMessage;
		}
	}

	/**
	 * Bootstrap cache with minimal fallback data to prevent infinite empty cache loops
	 * This ensures the system always has some data to serve, even if all data sources fail
	 */
	static bootstrapCacheWithFallback(errorMessage: string): void {
		if (cacheState.events && cacheState.events.length > 0) return;

		const now = Date.now();
		const fallbackEvents: Event[] = [
			{
				id: "bootstrap-fallback-1",
				name: "Service Temporarily Unavailable",
				day: "tbc",
				date: new Date(now + 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Tomorrow
				time: "12:00",
				endTime: "23:59",
				location: "Paris",
				arrondissement: 1,
				link: "",
				description:
					"Event data is temporarily unavailable. Please check back later or contact support.",
				type: "Day Party",
				genre: ["house"],
				venueTypes: ["indoor"],
				indoor: true,
				verified: false,
				price: "Free",
				age: "All ages",
				isOOOCPick: false,
				isFeatured: false,
				nationality: [],
			},
		];

		// Set bootstrap cache
		cacheState.events = fallbackEvents;
		cacheState.lastFetchTime = now;
		cacheState.lastRemoteFetchTime = now;
		cacheState.lastRemoteErrorMessage = `Bootstrap mode: ${errorMessage}`;
		cacheState.lastDataSource = "local";
		log.warn("cache", "Bootstrap mode: fallback event loaded", {
			reason: errorMessage,
		});
	}

	/**
	 * Get cached events if available and valid
	 */
	static getCachedEvents(): Event[] | null {
		if (!this.isCacheValid()) {
			return null;
		}

		return cacheState.events;
	}

	/**
	 * Get cached events even if expired (for fallback scenarios)
	 */
	static getCachedEventsForced(): Event[] | null {
		return cacheState.events;
	}

	/**
	 * Clear all cache data
	 */
	static clearCache(): void {
		cacheState.events = null;
		cacheState.lastFetchTime = 0;
		cacheState.lastRemoteFetchTime = 0;
		cacheState.lastRemoteSuccessTime = 0;
		cacheState.lastRemoteErrorMessage = "";
		cacheState.lastDataSource = "cached";
		cacheState.memoryUsage = 0;
	}

	/**
	 * Get comprehensive cache status
	 */
	static getCacheStatus(): CacheStateStatus {
		const now = Date.now();
		const cacheAge = cacheState.lastFetchTime
			? now - cacheState.lastFetchTime
			: 0;

		return {
			hasCachedData: cacheState.events !== null,
			lastFetchTime: cacheState.lastFetchTime
				? new Date(cacheState.lastFetchTime).toISOString()
				: null,
			lastRemoteFetchTime: cacheState.lastRemoteFetchTime
				? new Date(cacheState.lastRemoteFetchTime).toISOString()
				: null,
			lastRemoteSuccessTime: cacheState.lastRemoteSuccessTime
				? new Date(cacheState.lastRemoteSuccessTime).toISOString()
				: null,
			lastRemoteErrorMessage: cacheState.lastRemoteErrorMessage,
			cacheAge,
			nextRemoteCheck: cacheState.lastRemoteFetchTime
				? Math.max(
						0,
						getCacheManagerConfig().remoteRefreshInterval -
							(now - cacheState.lastRemoteFetchTime),
					)
				: 0,
			dataSource: cacheState.lastDataSource,
			eventCount: cacheState.events?.length || 0,
			memoryUsage: cacheState.memoryUsage,
			memoryLimit: getMemoryConfig().MAX_MEMORY_USAGE,
			memoryUtilization: cacheState.memoryUsage
				? parseFloat(
						(
							(cacheState.memoryUsage / getMemoryConfig().MAX_MEMORY_USAGE) *
							100
						).toFixed(1),
					)
				: 0,
		};
	}
}
