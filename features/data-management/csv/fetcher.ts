/**
 * CSV data fetching utilities
 * Handles local CSV file operations only
 *
 * Google Sheets functionality has been moved to @/lib/google/sheets/api.ts
 */

import { env } from "@/lib/config/env";

/**
 * Result of a successful CSV fetch operation
 *
 * @property content - The raw CSV content as a string
 * @property source - The source of the CSV data ("local" or "remote")
 * @property timestamp - Unix timestamp when the data was fetched
 */
export interface CSVFetchResult {
	content: string;
	source: "local" | "remote";
	timestamp: number;
}

/**
 * Error information for failed CSV fetch operations
 *
 * @property source - The source that failed (e.g., "Google Sheets", "Local CSV")
 * @property message - Detailed error message
 */
export interface CSVFetchError {
	source: string;
	message: string;
}

/**
 * Fetches CSV content from the local file system
 *
 * This function reads the events.csv file from the data directory in the project root.
 * It performs basic validation to ensure the file exists and contains data.
 *
 * @returns Promise resolving to the raw CSV content as a string
 * @throws {Error} When the file cannot be read, is empty, or doesn't exist
 *
 * @example
 * ```typescript
 * try {
 *   const csvContent = await fetchLocalCSV();
 *   console.log(`Loaded ${csvContent.split('\n').length} rows`);
 * } catch (error) {
 *   console.error('Failed to load local CSV:', error);
 * }
 * ```
 */
export async function fetchLocalCSV(): Promise<string> {
	const fs = await import("fs/promises");
	const path = await import("path");

	const csvPath = path.join(process.cwd(), "data", "events.csv");

	try {
		console.log(`📁 Loading local CSV from: ${csvPath}`);
		const csvContent = await fs.readFile(csvPath, "utf-8");

		if (!csvContent || csvContent.trim().length === 0) {
			throw new Error("Local CSV file is empty");
		}

		const rowCount = csvContent.split("\n").length - 1;
		console.log(`✅ Successfully loaded ${rowCount} rows from local CSV`);
		return csvContent;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		if (errorMessage.includes("ENOENT")) {
			console.error("❌ Local CSV file not found. Please ensure:");
			console.error(`   • File exists at: ${csvPath}`);
			console.error("   • The file has proper read permissions");
			console.error(
				"   • You may need to create this file as a fallback for when remote CSV fails",
			);
		}

		throw new Error(`Failed to read local CSV: ${errorMessage}`);
	}
}

/**
 * Multi-strategy CSV fetching with comprehensive fallback logic
 *
 * This function implements a robust data fetching strategy that tries multiple sources
 * in sequence, with graceful fallback to local data when remote sources fail.
 *
 * Strategy order:
 * 1. Google Sheets (if remoteUrl or sheetId provided)
 * 2. Local CSV file (fallback)
 *
 * Features:
 * - Comprehensive error handling and reporting
 * - Detailed logging for debugging
 * - Automatic fallback to local data
 * - Timestamp tracking for data freshness
 *
 * @param remoteUrl - Optional URL to a published Google Sheet
 * @param sheetId - Optional Google Sheet ID for direct API access
 * @param range - Optional sheet range to fetch (default: "A:Z")
 * @returns Promise resolving to a CSVFetchResult with content, source, and timestamp
 * @throws {Error} When all data sources fail, with detailed error information
 *
 * @example
 * ```typescript
 * try {
 *   const result = await fetchRemoteCSV(
 *     "https://docs.google.com/spreadsheets/d/...",
 *     "1abc123xyz...",
 *     "A1:Z100"
 *   );
 *   console.log(`Loaded ${result.content.split('\n').length} rows from ${result.source}`);
 * } catch (error) {
 *   console.error('All data sources failed:', error);
 * }
 * ```
 */
export async function fetchRemoteCSV(
	remoteUrl: string | null,
	sheetId: string | null,
	range: string = "A:Z",
	options?: {
		allowLocalFallback?: boolean;
	},
): Promise<CSVFetchResult> {
	const allowLocalFallback = options?.allowLocalFallback !== false;
	const errors: CSVFetchError[] = [];

	// Try Google Sheets strategies first (delegated to Google module)
	if (remoteUrl || sheetId) {
		try {
			console.log("🌐 Attempting Google Sheets data fetching...");
			// Use consolidated Google integration
			const { GoogleCloudAPI } = await import("@/lib/google/api");

			const result = await GoogleCloudAPI.fetchSheetsData(
				remoteUrl,
				sheetId,
				range,
			);
			return {
				content: result.content,
				source: "remote",
				timestamp: result.timestamp,
			};
		} catch (googleError) {
			const errorMsg =
				googleError instanceof Error ? googleError.message : "Unknown error";
			errors.push({ source: "Google Sheets", message: errorMsg });
			console.warn(`⚠️ Google Sheets strategies failed: ${errorMsg}`);
		}
	}

	if (!allowLocalFallback) {
		const errorMessages = errors
			.map((e) => `${e.source}: ${e.message}`)
			.join("; ");
		throw new Error(
			errorMessages || "Google Sheets source is not configured or unavailable",
		);
	}

	// Fallback to local CSV
	try {
		console.log("📁 Strategy: Falling back to local CSV...");
		const content = await fetchLocalCSV();
		console.log(
			`ℹ️ Using local CSV fallback (last updated: ${env.LOCAL_CSV_LAST_UPDATED || "unknown"})`,
		);
		return {
			content,
			source: "local",
			timestamp: Date.now(),
		};
	} catch (localError) {
		const errorMsg =
			localError instanceof Error ? localError.message : "Unknown error";
		errors.push({ source: "Local CSV", message: errorMsg });
		console.error(`❌ Local CSV fallback failed: ${errorMsg}`);
	}

	// All strategies failed
	console.error("💥 All data fetching strategies failed:");
	errors.forEach((error) =>
		console.error(`   • ${error.source}: ${error.message}`),
	);

	const errorMessages = errors
		.map((e) => `${e.source}: ${e.message}`)
		.join("; ");
	throw new Error(`All data sources failed: ${errorMessages}`);
}
