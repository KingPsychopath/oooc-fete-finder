/**
 * Data Management Module
 * Main interface for data fetching, processing, and management
 */

import { Event } from "@/types/events";
import { USE_CSV_DATA } from "@/data/events";
import { DATA_CONFIG, CACHE_CONFIG } from "./config";
import { fetchCSVWithFallbacks, extractSheetId, buildGoogleSheetsCSVUrl } from "./csv-fetcher";
import { processCSVData } from "./data-processor";

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
 * Configuration for dynamic sheet overrides
 */
interface DynamicSheetConfig {
	sheetId: string | null;
	range: string | null;
}

// Dynamic Google Sheet override (stored in memory for admin use)
let dynamicSheetConfig: DynamicSheetConfig = {
	sheetId: null,
	range: null,
};

/**
 * Data Manager class - handles all data operations
 */
export class DataManager {
	/**
	 * Fetch and process events data with smart fallback logic
	 */
	static async getEventsData(): Promise<DataManagerResult> {
		console.log("🔄 Loading events data...");
		console.log(`📊 Configuration: USE_CSV_DATA=${USE_CSV_DATA}`);

		const warnings: string[] = [];

		try {
			if (!USE_CSV_DATA) {
				console.log("📁 CSV remote fetching disabled (USE_CSV_DATA=false)");
				const { fetchLocalCSV } = await import('./csv-fetcher');
				const csvContent = await fetchLocalCSV();
				const processResult = await processCSVData(csvContent, 'local', false);
				
				return {
					success: true,
					data: processResult.events,
					count: processResult.count,
					source: 'local',
					cached: false,
					warnings: processResult.errors,
					lastUpdate: new Date().toISOString(),
				};
			}

			// Determine URLs and IDs for fetching
			const remoteUrl = dynamicSheetConfig.sheetId
				? buildGoogleSheetsCSVUrl(dynamicSheetConfig.sheetId, dynamicSheetConfig.range || "A:Z")
				: DATA_CONFIG.REMOTE_CSV_URL;

			const sheetId = dynamicSheetConfig.sheetId 
				|| DATA_CONFIG.GOOGLE_SHEET_ID 
				|| extractSheetId(DATA_CONFIG.REMOTE_CSV_URL);

			const range = dynamicSheetConfig.range 
				|| DATA_CONFIG.DEFAULT_SHEET_RANGE;

			console.log("🌐 Attempting multi-strategy data fetching...");

			// Fetch CSV with multiple fallback strategies
			const fetchResult = await fetchCSVWithFallbacks(remoteUrl, sheetId, range);
			
			// Process the fetched data
			const processResult = await processCSVData(
				fetchResult.content, 
				fetchResult.source, 
				true // Enable local fallback
			);

			// Combine any warnings
			warnings.push(...processResult.errors);

			console.log(`✅ Successfully loaded and processed ${processResult.count} events from ${processResult.source} source`);

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
			const errorMessage = error instanceof Error ? error.message : "Unknown error";

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
	 * Set dynamic sheet configuration for admin overrides
	 */
	static setDynamicSheet(
		sheetId: string | null,
		range: string | null = null,
	): {
		success: boolean;
		message: string;
		sheetId?: string;
		range?: string;
	} {
		try {
			if (!sheetId || sheetId.trim() === "") {
				// Clear dynamic override
				dynamicSheetConfig = { sheetId: null, range: null };
				return {
					success: true,
					message: "Dynamic sheet override cleared - using environment variables",
				};
			}

			const extractedId = extractSheetId(sheetId);
			if (!extractedId) {
				return {
					success: false,
					message: "Invalid Google Sheet URL or ID format",
				};
			}

			// Set dynamic override
			dynamicSheetConfig = {
				sheetId: extractedId,
				range: (range && range.trim()) || "A:Z",
			};

			console.log(
				`🔄 Dynamic Google Sheet set: ${dynamicSheetConfig.sheetId} (Range: ${dynamicSheetConfig.range})`,
			);

			return {
				success: true,
				message: "Dynamic sheet override set successfully",
				sheetId: dynamicSheetConfig.sheetId || undefined,
				range: dynamicSheetConfig.range || undefined,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Error setting dynamic sheet:", errorMessage);
			return {
				success: false,
				message: `Error: ${errorMessage}`,
			};
		}
	}

	/**
	 * Get current dynamic sheet configuration
	 */
	static getDynamicSheetConfig(): {
		sheetId: string | null;
		range: string | null;
		isActive: boolean;
	} {
		return {
			sheetId: dynamicSheetConfig.sheetId,
			range: dynamicSheetConfig.range,
			isActive: dynamicSheetConfig.sheetId !== null,
		};
	}

	/**
	 * Get data configuration status
	 */
	static getDataConfigStatus(): {
		useCsvData: boolean;
		remoteConfigured: boolean;
		localCsvLastUpdated: string;
		hasServiceAccount: boolean;
		hasDynamicOverride: boolean;
	} {
		const remoteConfigured = Boolean(
			DATA_CONFIG.REMOTE_CSV_URL ||
			process.env.GOOGLE_SHEETS_API_KEY ||
			process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
			process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
			dynamicSheetConfig.sheetId,
		);

		const hasServiceAccount = Boolean(
			process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
			process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);

		return {
			useCsvData: USE_CSV_DATA,
			remoteConfigured,
			localCsvLastUpdated: CACHE_CONFIG.LOCAL_CSV_LAST_UPDATED,
			hasServiceAccount,
			hasDynamicOverride: dynamicSheetConfig.sheetId !== null,
		};
	}
}

// Re-export types and utilities for convenience
export type { CSVFetchResult, CSVFetchError } from './csv-fetcher';
export type { ProcessedDataResult } from './data-processor';
export { extractSheetId, buildGoogleSheetsCSVUrl } from './csv-fetcher'; 