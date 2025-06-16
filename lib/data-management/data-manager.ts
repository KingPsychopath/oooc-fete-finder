/**
 * Data Management Module
 * Main interface for data fetching, processing, and management
 *
 * This module provides a centralized interface for handling event data operations,
 * including fetching from various sources (remote, local, static), processing,
 * and managing dynamic configurations.
 */

import { env } from "@/lib/config/env";
import { Event } from "@/types/events";
import { fetchRemoteCSV } from "./csv/fetcher";
import { processCSVData } from "./data-processor";
import { DynamicSheetManager } from "./dynamic-sheet-manager";

// When DATA_SOURCE is "static":
// - Uses the EVENTS_DATA object defined in this file
// - No external dependencies
// - Good for demos and offline development
export const DATA_SOURCE: "remote" | "local" | "static" = "remote";

/**
 * Result interface for data management operations
 * @interface DataManagerResult
 * @property {boolean} success - Whether the operation was successful
 * @property {Event[]} data - Array of processed events
 * @property {number} count - Number of events processed
 * @property {"remote" | "local"} source - Source of the data
 * @property {boolean} cached - Whether the data was served from cache
 * @property {string} [error] - Error message if operation failed
 * @property {string[]} warnings - Array of warning messages
 * @property {string} [lastUpdate] - ISO timestamp of last data update
 */
export interface DataManagerResult {
	success: boolean;
	data: Event[];
	count: number;
	source: "remote" | "local";
	cached: boolean;
	error?: string;
	warnings: string[];
	lastUpdate?: string;
}

/**
 * Data Manager class - handles all data operations
 *
 * This class provides static methods for managing event data, including:
 * - Fetching and processing events from various sources
 * - Providing data configuration status
 *
 * Note: Dynamic sheet configuration is now handled by DynamicSheetManager
 */
export class DataManager {
	/**
	 * Fetch and process events data with smart fallback logic
	 *
	 * This method implements a multi-strategy approach to fetch event data:
	 * 1. Static data (if configured)
	 * 2. Local CSV (if configured)
	 * 3. Remote sources (Google Sheets/CSV) with fallback to cache
	 *
	 * @returns {Promise<DataManagerResult>} Result containing processed events and metadata
	 * @throws {Error} If data processing fails
	 */
	static async getEventsData(): Promise<DataManagerResult> {
		console.log("🔄 Loading events data...");
		console.log(`📊 Configuration: DATA_SOURCE=${DATA_SOURCE}`);
		console.log(
			"🗺️ Coordinate population: AUTO (enabled for remote sources, disabled for local)",
		);

		const warnings: string[] = [];

		try {
			if (DATA_SOURCE === "static") {
				console.log("📦 Using static EVENTS_DATA object (DATA_SOURCE=static)");
				const { EVENTS_DATA } = await import("@/data/events");

				return {
					success: true,
					data: EVENTS_DATA,
					count: EVENTS_DATA.length,
					source: "local",
					cached: false,
					warnings: [],
					lastUpdate: new Date().toISOString(),
				};
			}

			if (DATA_SOURCE === "local") {
				console.log("📁 Using local CSV only (DATA_SOURCE=local)");
				const { fetchLocalCSV } = await import("./csv/fetcher");
				const csvContent = await fetchLocalCSV();
				const processResult = await processCSVData(csvContent, "local", false);

				return {
					success: true,
					data: processResult.events,
					count: processResult.count,
					source: "local",
					cached: false,
					warnings: processResult.errors,
					lastUpdate: new Date().toISOString(),
				};
			}

			// Get effective sheet configuration (dynamic override or environment)
			const effectiveConfig = DynamicSheetManager.getEffectiveConfig(
				env.GOOGLE_SHEET_ID,
				"A:Z", // Default sheet range
			);

			// Determine URLs and IDs for fetching
			let remoteUrl: string | null = null;
			let sheetId: string | null = effectiveConfig.sheetId;
			const range = effectiveConfig.range || "A:Z";

			// If we have a dynamic override, build the URL
			if (effectiveConfig.isDynamic && effectiveConfig.sheetId) {
				// Import Google utilities only when needed for URL building
				const { GoogleCloudAPI } = await import("../google/api");
				remoteUrl = GoogleCloudAPI.buildSheetsUrl(
					effectiveConfig.sheetId,
					range,
				);
			} else {
				// Use environment configuration
				remoteUrl = env.REMOTE_CSV_URL || null;

				// Extract sheet ID from remote URL if needed
				if (!sheetId && remoteUrl) {
					const { GoogleCloudAPI } = await import("../google/api");
					sheetId = GoogleCloudAPI.extractSheetId(remoteUrl);
				}
			}

			console.log("🌐 Attempting multi-strategy data fetching...");

			// Fetch CSV with multiple fallback strategies
			const fetchResult = await fetchRemoteCSV(remoteUrl, sheetId, range);

			// Process the fetched data (coordinate population auto-enabled for remote)
			const processResult = await processCSVData(
				fetchResult.content,
				fetchResult.source,
				false, // Disable local fallback - we'll handle cache vs local CSV priority
				{
					coordinateBatchSize: 5,
					onCoordinateProgress: (processed, total, current) => {
						if (processed % 10 === 0 || processed === total) {
							console.log(
								`🗺️ Geocoding progress: ${processed}/${total} events processed (current: ${current.name})`,
							);
						}
					},
				},
			);

			// Combine any warnings
			warnings.push(...processResult.errors);

			// Check if the processed data is valid
			const { isValidEventsData } = await import("./data-processor");
			if (!isValidEventsData(processResult.events)) {
				console.warn(
					`⚠️ Remote data validation failed (${processResult.count} events), checking for cached data before local CSV fallback`,
				);

				// Don't check cache here - let the cache manager handle fallback logic
				// This breaks the circular dependency
				console.log(
					`🔄 Remote data validation failed, letting cache manager handle fallback`,
				);

				// Return failure to let cache manager decide between cached data vs local CSV
				return {
					success: false,
					data: [],
					count: 0,
					source: "remote",
					cached: false,
					error: `Remote data validation failed`,
					warnings: [
						...warnings,
						"Remote data invalid - cache manager will handle fallback",
					],
				};
			}

			console.log(
				`✅ Successfully loaded and processed ${processResult.count} events from ${processResult.source} source`,
			);

			return {
				success: true,
				data: processResult.events,
				count: processResult.count,
				source: processResult.source,
				cached: false,
				warnings,
				lastUpdate: new Date(fetchResult.timestamp).toISOString(),
			};
		} catch (error) {
			console.error("❌ Error loading events data:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			// Record the failed remote attempt for cache management
			if (DATA_SOURCE === "remote") {
				// Don't check cache here - let the cache manager handle fallback logic
				// This breaks the circular dependency
				console.log(
					`🔄 Remote fetch failed in ${DATA_SOURCE} mode: ${errorMessage}`,
				);
			}

			return {
				success: false,
				data: [],
				count: 0,
				source: "local",
				cached: false,
				error: errorMessage,
				warnings,
			};
		}
	}

	/**
	 * Get data configuration status
	 *
	 * Provides a comprehensive overview of the current data configuration state,
	 * including source type, remote configuration status, and service account availability.
	 *
	 * @returns {{
	 *   dataSource: "remote" | "local" | "static";
	 *   remoteConfigured: boolean;
	 *   localCsvLastUpdated: string;
	 *   hasServiceAccount: boolean;
	 *   hasDynamicOverride: boolean;
	 * }} Current configuration status
	 */
	static getDataConfigStatus(): {
		dataSource: "remote" | "local" | "static";
		remoteConfigured: boolean;
		localCsvLastUpdated: string;
		hasServiceAccount: boolean;
		hasDynamicOverride: boolean;
	} {
		// Use consolidated service account check (synchronous check)
		const hasServiceAccount = Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);

		const remoteConfigured = Boolean(
			env.REMOTE_CSV_URL ||
				env.GOOGLE_SHEETS_API_KEY ||
				hasServiceAccount ||
				DynamicSheetManager.hasDynamicOverride(),
		);

		return {
			dataSource: DATA_SOURCE,
			remoteConfigured,
			localCsvLastUpdated: env.LOCAL_CSV_LAST_UPDATED || "unknown",
			hasServiceAccount,
			hasDynamicOverride: DynamicSheetManager.hasDynamicOverride(),
		};
	}
}
