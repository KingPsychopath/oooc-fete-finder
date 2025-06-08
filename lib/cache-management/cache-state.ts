/**
 * Cache State Management
 * Handles in-memory cache state and operations
 */

import { Event } from "@/types/events";
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