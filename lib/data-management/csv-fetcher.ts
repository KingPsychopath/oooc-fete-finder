/**
 * CSV data fetching utilities
 * Handles local CSV file operations only
 * 
 * Google Sheets functionality has been moved to @/lib/google/gcp-api.ts
 */

import { getCacheManagerConfig } from "../cache-management/cache-config";

export interface CSVFetchResult {
	content: string;
	source: "local" | "remote";
	timestamp: number;
}

export interface CSVFetchError {
	source: string;
	message: string;
}

/**
 * Fetch CSV content from local file system
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
 * Coordinates between Google Sheets (via Google module) and local CSV
 */
export async function fetchCSVWithFallbacks(
	remoteUrl: string | null,
	sheetId: string | null,
	range: string = "A:Z",
): Promise<CSVFetchResult> {
	const errors: CSVFetchError[] = [];

	// Try Google Sheets strategies first (delegated to Google module)
	if (remoteUrl || sheetId) {
		try {
			console.log("🌐 Attempting Google Sheets data fetching...");
			// Use consolidated Google integration
			const { GoogleCloudAPI } = await import("../google/gcp-api");
			
			const result = await GoogleCloudAPI.fetchSheetsData(remoteUrl, sheetId, range);
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

	// Fallback to local CSV
	try {
		console.log("📁 Strategy: Falling back to local CSV...");
		const content = await fetchLocalCSV();
		console.log(
			`ℹ️ Using local CSV fallback (last updated: ${getCacheManagerConfig().localCsvLastUpdated})`,
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
