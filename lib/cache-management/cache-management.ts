/**
 * Cache Management Module
 * Main interface for cache operations, state management, and invalidation
 */

import { Event } from "@/types/events";
import { CacheStateManager } from "./cache-state";
import { CacheInvalidationManager } from "./cache-invalidation";
import { DataManager } from "../data-management/data-management";

export interface EventsResult {
	success: boolean;
	data: Event[];
	count: number;
	cached: boolean;
	source: "remote" | "local" | "cached";
	error?: string;
	lastUpdate?: string;
}

export interface CacheRefreshResult {
	success: boolean;
	message: string;
	data?: Event[];
	count?: number;
	source?: "remote" | "local" | "cached";
	error?: string;
}

export interface FullRevalidationResult {
	success: boolean;
	message: string;
	cacheRefreshed: boolean;
	pageRevalidated: boolean;
	error?: string;
	details?: {
		cacheResult?: CacheRefreshResult;
		cacheError?: string;
		revalidationError?: string;
	};
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
	useCsvData: boolean;
	eventCount: number;
	localCsvLastUpdated: string;
	remoteConfigured: boolean;
}

/**
 * Cache Manager class - main interface for cache operations
 */
export class CacheManager {
	/**
	 * Get events with smart caching and fallback logic
	 */
	static async getEvents(forceRefresh: boolean = false): Promise<EventsResult> {
		try {
			const now = Date.now();

			// Return cached data if valid and not forcing refresh
			if (!forceRefresh) {
				const cachedEvents = CacheStateManager.getCachedEvents();
				if (cachedEvents) {
					const cacheState = CacheStateManager.getState();
					console.log(
						`🔄 Using cached events data (${cachedEvents.length} events, cached ${Math.round((now - cacheState.lastFetchTime) / 1000)}s ago)`,
					);
					return {
						success: true,
						data: cachedEvents,
						count: cachedEvents.length,
						cached: true,
						source: cacheState.lastDataSource,
						lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
					};
				}
			}

			console.log("🔄 Loading fresh events data...");

			// Fetch fresh data from data management layer
			const dataResult = await DataManager.getEventsData();

			if (dataResult.success) {
				// Update cache with new data
				CacheStateManager.updateCache(
					dataResult.data,
					dataResult.source,
					dataResult.error
				);

				console.log(
					`✅ Successfully loaded and cached ${dataResult.count} events from ${dataResult.source} source`,
				);

				const result: EventsResult = {
					success: true,
					data: dataResult.data,
					count: dataResult.count,
					cached: false,
					source: dataResult.source,
					lastUpdate: dataResult.lastUpdate,
				};

				// Add warnings if there were any
				if (dataResult.warnings.length > 0) {
					result.error = `Warnings: ${dataResult.warnings.join("; ")}`;
					console.warn("⚠️ Non-fatal errors occurred:", dataResult.warnings);
				}

				return result;
			} else {
				// Data fetch failed, try to return cached data even if expired
				const expiredCachedEvents = CacheStateManager.getCachedEventsForced();
				if (expiredCachedEvents) {
					const cacheState = CacheStateManager.getState();
					console.log("⚠️ Returning expired cached data due to fetch failure");
					console.log(
						`   Cached data: ${expiredCachedEvents.length} events from ${cacheState.lastDataSource} source`,
					);
					return {
						success: true,
						data: expiredCachedEvents,
						count: expiredCachedEvents.length,
						cached: true,
						source: cacheState.lastDataSource,
						error: `Using cached data due to error: ${dataResult.error}`,
						lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
					};
				}

				console.error("❌ No cached data available, returning empty result");
				return {
					success: false,
					data: [],
					count: 0,
					cached: false,
					source: "local",
					error: dataResult.error,
				};
			}
		} catch (error) {
			console.error("❌ Error in cache manager:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";

			// Try to return cached data as fallback
			const expiredCachedEvents = CacheStateManager.getCachedEventsForced();
			if (expiredCachedEvents) {
				const cacheState = CacheStateManager.getState();
				console.log("⚠️ Returning expired cached data due to error");
				return {
					success: true,
					data: expiredCachedEvents,
					count: expiredCachedEvents.length,
					cached: true,
					source: cacheState.lastDataSource,
					error: `Using cached data due to error: ${errorMessage}`,
					lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
				};
			}

			return {
				success: false,
				data: [],
				count: 0,
				cached: false,
				source: "local",
				error: errorMessage,
			};
		}
	}

	/**
	 * Force refresh the events cache with smart invalidation
	 */
	static async forceRefresh(): Promise<CacheRefreshResult> {
		try {
			console.log("🔄 Force refreshing events cache with smart invalidation...");
			const startTime = Date.now();
			
			// Get current cached data for comparison
			const currentData = CacheStateManager.getCachedEventsForced();
			
			// Get fresh data
			const result = await this.getEvents(true);
			const processingTime = Date.now() - startTime;

			if (result.success) {
				// Perform smart cache invalidation
				const invalidationResult = await CacheInvalidationManager.smartInvalidation(
					result.data,
					currentData
				);
				
				console.log(`✅ Force refresh completed in ${processingTime}ms`);
				console.log(`🧹 Cache invalidation: ${invalidationResult.message}`);

				return {
					success: true,
					message: `Successfully refreshed ${result.count} events from ${result.source} source (${processingTime}ms). ${invalidationResult.message}`,
					data: result.data,
					count: result.count,
					source: result.source,
				};
			} else {
				return {
					success: false,
					message: "Failed to refresh events",
					error: result.error,
				};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Force refresh failed:", errorMessage);
			return {
				success: false,
				message: "Force refresh failed",
				error: errorMessage,
			};
		}
	}

	/**
	 * Get comprehensive cache status
	 */
	static async getCacheStatus(): Promise<CacheStatus> {
		// If we have no cached data, try to load some first
		const cacheState = CacheStateManager.getState();
		if (!cacheState.events) {
			console.log("🔄 No cached data found, attempting to load events for cache status...");
			try {
				await this.getEvents(false);
			} catch (error) {
				console.log(
					"⚠️ Failed to load events for cache status:",
					error instanceof Error ? error.message : "Unknown error",
				);
			}
		}

		// Get cache status from state manager
		const baseCacheStatus = CacheStateManager.getCacheStatus();
		
		// Get data configuration from data manager
		const dataConfigStatus = DataManager.getDataConfigStatus();

		// Combine both statuses
		return {
			...baseCacheStatus,
			useCsvData: dataConfigStatus.useCsvData,
			localCsvLastUpdated: dataConfigStatus.localCsvLastUpdated,
			remoteConfigured: dataConfigStatus.remoteConfigured,
		};
	}

	/**
	 * Complete revalidation - refresh cache AND invalidate page cache
	 */
	static async fullRevalidation(path: string = "/"): Promise<FullRevalidationResult> {
		console.log(`🔄 Starting enhanced full revalidation for path: ${path}`);
		const startTime = Date.now();

		let cacheRefreshed = false;
		let pageRevalidated = false;
		const details: FullRevalidationResult["details"] = {};

		try {
			// Step 1: Force refresh the events cache (includes smart invalidation)
			try {
				console.log("🔄 Step 1: Force refreshing events cache with smart invalidation...");
				const cacheResult = await this.forceRefresh();
				details.cacheResult = cacheResult;

				if (cacheResult.success) {
					cacheRefreshed = true;
					console.log("✅ Step 1: Successfully refreshed events cache with invalidation");
				} else {
					console.warn("⚠️ Step 1: Failed to refresh events cache");
				}
			} catch (cacheError) {
				const cacheErrorMessage = cacheError instanceof Error ? cacheError.message : "Unknown error";
				console.error("❌ Step 1: Error refreshing events cache:", cacheErrorMessage);
				details.cacheError = cacheErrorMessage;
			}

			// Step 2: Additional cache clearing
			try {
				console.log("🔄 Step 2: Performing additional cache clearing...");
				const paths = [path];
				
				// Add common paths that might need clearing
				if (path === "/") {
					paths.push("/events", "/admin");
				}
				
				const clearResult = await CacheInvalidationManager.clearAllCaches(paths);
				
				if (clearResult.success) {
					pageRevalidated = true;
					console.log(`✅ Step 2: Successfully cleared all cache layers for paths: ${clearResult.clearedPaths.join(", ")}`);
				} else {
					console.warn(`⚠️ Step 2: Cache clearing had errors: ${clearResult.errors.join("; ")}`);
					pageRevalidated = clearResult.clearedPaths.length > 0;
				}
				
				details.revalidationError = clearResult.errors.length > 0 ? clearResult.errors.join("; ") : undefined;
			} catch (revalidationError) {
				const revalidationErrorMessage = revalidationError instanceof Error 
					? revalidationError.message 
					: "Unknown error";
				console.error("❌ Step 2: Error in cache clearing:", revalidationErrorMessage);
				details.revalidationError = revalidationErrorMessage;
			}

			const endTime = Date.now();
			const duration = endTime - startTime;

			return {
				success: cacheRefreshed || pageRevalidated,
				message: `Enhanced full revalidation completed in ${duration}ms. Cache: ${cacheRefreshed ? "refreshed" : "failed"}, Pages: ${pageRevalidated ? "cleared" : "failed"}`,
				cacheRefreshed,
				pageRevalidated,
				details,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Full revalidation failed:", errorMessage);
			return {
				success: false,
				message: "Full revalidation failed",
				cacheRefreshed,
				pageRevalidated,
				error: errorMessage,
				details,
			};
		}
	}

	/**
	 * Clear all cache data (useful for testing or admin operations)
	 */
	static clearCache(): void {
		CacheStateManager.clearCache();
	}

	/**
	 * Emergency cache bust
	 */
	static async emergencyCacheBust() {
		return CacheInvalidationManager.emergencyCacheBust();
	}

	/**
	 * Dynamic sheet configuration methods (delegated to DataManager)
	 */
	static setDynamicSheet(sheetId: string | null, range: string | null = null) {
		return DataManager.setDynamicSheet(sheetId, range);
	}

	static getDynamicSheetConfig() {
		return DataManager.getDynamicSheetConfig();
	}
}

// Re-export types and utilities for convenience
export type { 
	CacheState, 
	CacheStatus as CacheStateStatus 
} from './cache-state';
export type { 
	ChangeDetails, 
	InvalidationResult, 
	CacheClearResult, 
	EmergencyCacheBustResult 
} from './cache-invalidation';
export { CacheStateManager } from './cache-state';
export { CacheInvalidationManager } from './cache-invalidation'; 