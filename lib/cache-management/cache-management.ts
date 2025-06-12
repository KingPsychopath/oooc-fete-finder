/**
 * Cache Management Module
 * Main interface for cache operations, state management, and invalidation
 */

import { Event } from "@/types/events";
import { CacheStateManager } from "./cache-state";
import { CacheInvalidationManager } from "./cache-invalidation";
import { CacheRequestDeduplicator } from "./cache-deduplication";
import { CacheMetrics } from "./cache-metrics";
import { getCacheConfig, CacheConfigManager } from "./cache-config";
import { DataManager } from "../data-management/data-management";
import { isValidEventsData } from "../data-management/data-processor";
import type {
	EventsResult,
	CacheRefreshResult,
	FullRevalidationResult,
	CacheStatus,
} from "./cache-types";



/**
 * Cache Manager class - main interface for cache operations
 */
export class CacheManager {
	/**
	 * Get events with smart caching and fallback logic
	 */
	static async getEvents(forceRefresh: boolean = false): Promise<EventsResult> {
		return CacheRequestDeduplicator.deduplicateGetEvents(forceRefresh, async () => {
			const startTime = Date.now();
			
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
						
						// Record cache hit
						CacheMetrics.recordCacheHit();
						
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

				// Record cache miss
				CacheMetrics.recordCacheMiss();
				console.log("🔄 Loading fresh events data...");

				// Fetch fresh data from data management layer
				const dataResult = await DataManager.getEventsData();

				if (dataResult.success && isValidEventsData(dataResult.data)) {
					// Update cache with new valid data
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

					// Record successful fetch time
					CacheMetrics.recordFetchTime(Date.now() - startTime);
					
					return result;
				} else {
					// Data fetch failed or returned invalid data
					const errorMessage = dataResult.success 
						? "Remote data validation failed - data is empty or invalid"
						: dataResult.error || "Unknown error";

					// Record error
					CacheMetrics.recordError();

					// PRIORITIZED FALLBACK LOGIC:
					// 1. Try cached data first (more recent than local CSV)
					const cachedEvents = CacheStateManager.getCachedEventsForced();
					if (cachedEvents && isValidEventsData(cachedEvents)) {
						const cacheState = CacheStateManager.getState();
						
						// Refresh cache validity timer to keep serving cached data
						CacheStateManager.refreshCacheValidity(errorMessage);
						
						console.log("🔄 Remote fetch failed/invalid, using cached data (prioritized over local CSV)");
						console.log(
							`   Serving cached data: ${cachedEvents.length} events from ${cacheState.lastDataSource} source`,
						);
						
						return {
							success: true,
							data: cachedEvents,
							count: cachedEvents.length,
							cached: true,
							source: cacheState.lastDataSource,
							error: `Using cached data due to remote issue: ${errorMessage}`,
							lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
						};
					}

					// 2. No cached data - try local CSV fallback
					console.log("🔄 No cached data available, trying local CSV fallback...");
					try {
						const { fetchLocalCSV } = await import('../data-management/csv-fetcher');
						const { processCSVData } = await import('../data-management/data-processor');
						
						const localCsvContent = await fetchLocalCSV();
						const localProcessResult = await processCSVData(localCsvContent, 'local', false);
						
						if (isValidEventsData(localProcessResult.events)) {
							console.log(`✅ Successfully fell back to local CSV with ${localProcessResult.count} events`);
							
							// Cache the local data for future use
							CacheStateManager.updateCache(
								localProcessResult.events,
								'local',
								`Fallback from remote failure: ${errorMessage}`
							);
							
							return {
								success: true,
								data: localProcessResult.events,
								count: localProcessResult.count,
								cached: false,
								source: 'local',
								error: `Used local CSV fallback due to remote issue: ${errorMessage}`,
								lastUpdate: new Date().toISOString(),
							};
						}
					} catch (localError) {
						const localErrorMsg = localError instanceof Error ? localError.message : "Unknown error";
						console.error(`❌ Local CSV fallback also failed: ${localErrorMsg}`);
					}

					// 3. Both remote and local failed - activate bootstrap mode
					console.error("❌ All data sources failed, activating bootstrap mode");
					CacheStateManager.bootstrapCacheWithFallback(errorMessage);
					
					const bootstrapEvents = CacheStateManager.getCachedEventsForced();
					if (bootstrapEvents) {
						console.log("🚨 Bootstrap mode: Serving fallback event to prevent empty cache loop");
						return {
							success: true,
							data: bootstrapEvents,
							count: bootstrapEvents.length,
							cached: true,
							source: "local",
							error: `Bootstrap mode activated: ${errorMessage}`,
						};
					}

					// This should never happen, but just in case
					return {
						success: false,
						data: [],
						count: 0,
						cached: false,
						source: "local",
						error: errorMessage,
					};
				}
			} catch (error) {
				console.error("❌ Error in cache manager:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				
				// Record error
				CacheMetrics.recordError();

				// Try to return cached data as fallback and refresh its validity
				const cachedEvents = CacheStateManager.getCachedEventsForced();
				if (cachedEvents && isValidEventsData(cachedEvents)) {
					const cacheState = CacheStateManager.getState();
					
					// Refresh cache validity timer to keep serving cached data
					CacheStateManager.refreshCacheValidity(errorMessage);
					
					console.log("🔄 Exception occurred, refreshed cached data validity");
					console.log(`   Serving cached data: ${cachedEvents.length} events from ${cacheState.lastDataSource} source`);
					
					return {
						success: true,
						data: cachedEvents,
						count: cachedEvents.length,
						cached: true,
						source: cacheState.lastDataSource,
						error: `Using cached data due to error: ${errorMessage}`,
						lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
					};
				}

				// No valid cached data available - activate bootstrap mode
				console.error("❌ Exception occurred with no valid cached data, activating bootstrap mode");
				CacheStateManager.bootstrapCacheWithFallback(errorMessage);
				
				const bootstrapEvents = CacheStateManager.getCachedEventsForced();
				if (bootstrapEvents) {
					console.log("🚨 Bootstrap mode: Serving fallback event after exception");
					return {
						success: true,
						data: bootstrapEvents,
						count: bootstrapEvents.length,
						cached: true,
						source: "local",
						error: `Bootstrap mode activated after exception: ${errorMessage}`,
					};
				}

				// This should never happen, but just in case
				return {
					success: false,
					data: [],
					count: 0,
					cached: false,
					source: "local",
					error: errorMessage,
				};
			}
		});
	}

	/**
	 * Force refresh the events cache with smart invalidation
	 */
	static async forceRefresh(): Promise<CacheRefreshResult> {
		return CacheRequestDeduplicator.deduplicateForceRefresh(async () => {
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
					// Force refresh failed, but if we have valid cached data, the system is still operational
					if (currentData && isValidEventsData(currentData)) {
						console.log("⚠️ Force refresh failed, but cached data is still valid and being served");
						return {
							success: false,
							message: `Force refresh failed, but ${currentData.length} cached events are still being served`,
							error: result.error,
							data: currentData,
							count: currentData.length,
							source: "cached",
						};
					}
					
					return {
						success: false,
						message: "Failed to refresh events and no valid cached data available",
						error: result.error,
					};
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				console.error("❌ Force refresh failed:", errorMessage);
				CacheMetrics.recordError();
				return {
					success: false,
					message: "Force refresh failed",
					error: errorMessage,
				};
			}
		});
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
			configuredDataSource: dataConfigStatus.dataSource,
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

	/**
	 * Get cache performance metrics
	 */
	static getCacheMetrics() {
		return CacheMetrics.getMetrics();
	}
	
	/**
	 * Reset cache performance metrics
	 */
	static resetCacheMetrics(): void {
		CacheMetrics.resetMetrics();
	}
	
	/**
	 * Clear all pending requests (useful for testing)
	 */
	static clearPendingRequests(): void {
		// Use the base RequestDeduplicator for clearing
		const { RequestDeduplicator } = require('./cache-deduplication');
		RequestDeduplicator.clearPendingRequests();
	}
}

// Re-export types and utilities for convenience
export type { 
	EventsResult,
	CacheRefreshResult,
	FullRevalidationResult,
	CacheStatus,
	CacheStateStatus,
	CacheState,
	CacheMetricsData,
	ChangeDetails, 
	InvalidationResult, 
	CacheClearResult, 
	EmergencyCacheBustResult,
	MemoryStats,
	MemoryLimitsCheck,
	CacheConfiguration,
	DataSource,
	CacheOperationResult,
	MemoryHealthStatus,
	CacheOperation
} from './cache-types';
export { CacheStateManager } from './cache-state';
export { CacheInvalidationManager } from './cache-invalidation'; 