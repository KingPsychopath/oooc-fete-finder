/**
 * Cache State Management
 * Handles in-memory cache state and operations
 */

import { Event, MusicGenre, ParisArrondissement, Nationality } from "@/types/events";
import { CACHE_CONFIG } from "../data-management/config";

export interface CacheState {
	events: Event[] | null;
	lastFetchTime: number;
	lastRemoteFetchTime: number;
	lastRemoteSuccessTime: number;
	lastRemoteErrorMessage: string;
	lastDataSource: "remote" | "local" | "cached";
}

export interface CacheStatus {
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: "remote" | "local" | "cached";
	eventCount: number;
}

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
};

/**
 * Cache State Manager class
 */
export class CacheStateManager {
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
		return (now - cacheState.lastFetchTime) < CACHE_CONFIG.CACHE_DURATION;
	}

	/**
	 * Check if it's time for a remote refresh
	 */
	static shouldRefreshRemote(): boolean {
		const now = Date.now();
		return (now - cacheState.lastRemoteFetchTime) > CACHE_CONFIG.REMOTE_REFRESH_INTERVAL;
	}

	/**
	 * Update cache with new events data
	 */
	static updateCache(
		events: Event[],
		source: "remote" | "local",
		errorMessage?: string
	): void {
		const now = Date.now();
		const previousFetchTime = cacheState.lastFetchTime;
		
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
		console.log(`📦 Cache updated: ${events.length} events from ${source} source`);
		console.log(`⏰ Cache timestamps - lastFetchTime: ${now}, previous: ${previousFetchTime}, age reset from: ${timeSincePrevious}ms to 0ms`);
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
		const MAX_CACHE_AGE = CACHE_CONFIG.MAX_CACHE_AGE;
		const EXTENSION_DURATION = CACHE_CONFIG.CACHE_EXTENSION_DURATION;
		
		if (cacheAge < MAX_CACHE_AGE) {
			// Cache is not too old yet - extend its validity by a reasonable amount
			cacheState.lastFetchTime = now - (cacheAge - EXTENSION_DURATION);
			console.log(`🔄 Cache validity extended: age ${Math.round(cacheAge / 60000)}min, extended by ${EXTENSION_DURATION / 60000}min`);
		} else {
			// Cache is getting very old - refresh to current time but log warning
			cacheState.lastFetchTime = now;
			console.log(`⚠️ Cache is very old (${Math.round(cacheAge / 60000)}min), refreshing to current time`);
			console.log("📊 Consider checking data source connectivity - cache data may be significantly outdated");
		}
		
		// Record the remote attempt
		cacheState.lastRemoteFetchTime = now;
		if (errorMessage) {
			cacheState.lastRemoteErrorMessage = errorMessage;
		}

		const newCacheAge = now - cacheState.lastFetchTime;
		console.log(`⏰ Cache validity refreshed - effective age: ${Math.round(newCacheAge / 60000)}min`);
		
		if (errorMessage) {
			console.log(`📡 Remote fetch failed, but cached data remains valid: ${errorMessage}`);
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
				date: new Date(now + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
				time: "12:00",
				endTime: "23:59",
				location: "Paris",
				arrondissement: 1,
				link: "",
				description: "Event data is temporarily unavailable. Please check back later or contact support.",
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
			}
		];

		// Set bootstrap cache
		cacheState.events = fallbackEvents;
		cacheState.lastFetchTime = now;
		cacheState.lastRemoteFetchTime = now;
		cacheState.lastRemoteErrorMessage = `Bootstrap mode: ${errorMessage}`;
		cacheState.lastDataSource = "local";

		console.log("🚨 Bootstrap mode activated: Cache populated with fallback event");
		console.log(`📡 Bootstrap reason: ${errorMessage}`);
		console.log("⚠️ This prevents infinite empty cache loops while data sources are unavailable");
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
		
		console.log("🗑️ Cache state cleared");
	}

	/**
	 * Get comprehensive cache status
	 */
	static getCacheStatus(): CacheStatus {
		const now = Date.now();
		const cacheAge = cacheState.lastFetchTime ? now - cacheState.lastFetchTime : 0;

		console.log(`📊 Cache status calculated - now: ${now}, lastFetchTime: ${cacheState.lastFetchTime}, cacheAge: ${cacheAge}ms`);

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
						CACHE_CONFIG.REMOTE_REFRESH_INTERVAL - (now - cacheState.lastRemoteFetchTime),
					)
				: 0,
			dataSource: cacheState.lastDataSource,
			eventCount: cacheState.events?.length || 0,
		};
	}
} 