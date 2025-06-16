/**
 * Cache State Management
 * Handles in-memory cache state and operations
 */

import { Event } from "@/types/events";
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

		// Log memory status periodically (check before updating lastMemoryCheck)
		const shouldLog =
			now - cacheState.lastMemoryCheck >
			getMemoryConfig().MEMORY_CHECK_INTERVAL;
		if (shouldLog || needsCleanup) {
			console.log(
				`💾 Memory Usage: ${(currentUsage / 1024 / 1024).toFixed(2)}MB / ${(maxLimit / 1024 / 1024).toFixed(2)}MB (${utilizationPercent.toFixed(1)}%)`,
			);

			if (needsEmergencyCleanup) {
				console.warn("🚨 EMERGENCY: Cache memory usage critical!");
			} else if (needsCleanup) {
				console.warn("⚠️ Cache memory usage high, cleanup recommended");
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
		if (!cacheState.events || cacheState.events.length === 0) {
			console.log("💾 No cached data to clean up");
			return;
		}

		console.log("🧹 Performing cache memory cleanup...");

		// For events cache, we can't partial-cleanup easily, so we clear the whole cache
		// In a more complex scenario, you might implement LRU or keep only recent events
		const oldEventCount = cacheState.events.length;
		const oldMemoryUsage = cacheState.memoryUsage;

		this.clearCache();

		console.log(
			`✅ Memory cleanup completed: ${oldEventCount} events (${(oldMemoryUsage / 1024 / 1024).toFixed(2)}MB) cleared`,
		);
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
		source: "remote" | "local",
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
			console.error(
				"🚨 Cannot update cache: would exceed emergency memory threshold",
			);
			console.error(
				`   Requested: ${(newMemoryUsage / 1024 / 1024).toFixed(2)}MB, Limit: ${(getMemoryConfig().MAX_MEMORY_USAGE / 1024 / 1024).toFixed(2)}MB`,
			);

			// Restore previous memory usage and attempt cleanup
			cacheState.memoryUsage = tempMemoryUsage;
			this.performMemoryCleanup();

			// Try again after cleanup
			cacheState.memoryUsage = newMemoryUsage;
			const recheckMemory = this.checkMemoryLimits();

			if (recheckMemory.needsEmergencyCleanup) {
				console.error(
					"🚨 Still exceeds memory limits after cleanup, rejecting cache update",
				);
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

		const timeSincePrevious = previousFetchTime ? now - previousFetchTime : 0;
		console.log(
			`📦 Cache updated: ${events.length} events from ${source} source`,
		);
		console.log(
			`💾 Memory usage: ${(newMemoryUsage / 1024 / 1024).toFixed(2)}MB (${((newMemoryUsage / getMemoryConfig().MAX_MEMORY_USAGE) * 100).toFixed(1)}%)`,
		);
		console.log(
			`⏰ Cache timestamps - lastFetchTime: ${now}, previous: ${previousFetchTime}, age reset from: ${timeSincePrevious}ms to 0ms`,
		);

		// Perform cleanup if needed
		if (memoryCheck.needsCleanup && !memoryCheck.needsEmergencyCleanup) {
			console.log("🧹 Scheduling memory cleanup for next cycle");
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

		console.log(`📡 Remote fetch attempt recorded: ${errorMessage}`);
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
		if (!cacheState.events) {
			console.log("⚠️ Cannot refresh cache validity - no cached data exists");
			return;
		}

		const now = Date.now();
		const originalFetchTime = cacheState.lastFetchTime;
		const cacheAge = now - originalFetchTime;

		// Hybrid approach: Balance between keeping service available and preventing indefinitely old data
		const config = getCacheManagerConfig();
		const MAX_CACHE_AGE = config.maxCacheAge;
		const EXTENSION_DURATION = config.cacheExtensionDuration;

		if (cacheAge < MAX_CACHE_AGE) {
			// Cache is not too old yet - extend its validity by a reasonable amount
			cacheState.lastFetchTime = now - (cacheAge - EXTENSION_DURATION);
			console.log(
				`🔄 Cache validity extended: age ${Math.round(cacheAge / 60000)}min, extended by ${EXTENSION_DURATION / 60000}min`,
			);
		} else {
			// Cache is getting very old - refresh to current time but log warning
			cacheState.lastFetchTime = now;
			console.log(
				`⚠️ Cache is very old (${Math.round(cacheAge / 60000)}min), refreshing to current time`,
			);
			console.log(
				"📊 Consider checking data source connectivity - cache data may be significantly outdated",
			);
		}

		// Record the remote attempt
		cacheState.lastRemoteFetchTime = now;
		if (errorMessage) {
			cacheState.lastRemoteErrorMessage = errorMessage;
		}

		const newCacheAge = now - cacheState.lastFetchTime;
		console.log(
			`⏰ Cache validity refreshed - effective age: ${Math.round(newCacheAge / 60000)}min`,
		);

		if (errorMessage) {
			console.log(
				`📡 Remote fetch failed, but cached data remains valid: ${errorMessage}`,
			);
		}
	}

	/**
	 * Bootstrap cache with minimal fallback data to prevent infinite empty cache loops
	 * This ensures the system always has some data to serve, even if all data sources fail
	 */
	static bootstrapCacheWithFallback(errorMessage: string): void {
		if (cacheState.events && cacheState.events.length > 0) {
			console.log("ℹ️ Cache already has data, skipping bootstrap");
			return;
		}

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

		console.log(
			"🚨 Bootstrap mode activated: Cache populated with fallback event",
		);
		console.log(`📡 Bootstrap reason: ${errorMessage}`);
		console.log(
			"⚠️ This prevents infinite empty cache loops while data sources are unavailable",
		);
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

		console.log("🗑️ Cache state cleared");
	}

	/**
	 * Get comprehensive cache status
	 */
	static getCacheStatus(): CacheStateStatus {
		const now = Date.now();
		const cacheAge = cacheState.lastFetchTime
			? now - cacheState.lastFetchTime
			: 0;

		console.log(
			`📊 Cache status calculated - now: ${now}, lastFetchTime: ${cacheState.lastFetchTime}, cacheAge: ${cacheAge}ms`,
		);

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
