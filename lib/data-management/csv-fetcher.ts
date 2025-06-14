/**
 * CSV data fetching utilities
 * Handles fetching CSV data from local files, remote URLs, and Google Sheets
 */

import { getCacheConfig } from "../cache-management/cache-config";
import { ServerEnvironmentManager } from "@/lib/config/env";

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
 * Build Google Sheets CSV export URL
 */
export function buildGoogleSheetsCSVUrl(
	sheetId: string,
	range: string = "A1:O1000",
): string {
	return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&range=${encodeURIComponent(range)}`;
}

/**
 * Extract sheet ID from various Google Sheets URL formats
 */
export function extractSheetId(input: string): string | null {
	if (!input) return null;

	// If it's already just an ID
	if (input.length === 44 && !input.includes("/")) {
		return input;
	}

	// Extract from full URL
	const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	return match ? match[1] : null;
}

/**
 * Fetch CSV from public Google Sheets URL
 */
export async function fetchRemoteCSV(targetUrl: string): Promise<string> {
	if (!targetUrl) {
		throw new Error("No remote CSV URL provided");
	}

	console.log(`📡 Fetching remote CSV from: ${targetUrl.substring(0, 50)}...`);

	try {
		const response = await fetch(targetUrl, {
			signal: AbortSignal.timeout(15000), // 15 second timeout
			headers: {
				"User-Agent": "OOOC-Fete-Finder/1.0",
			},
		});

		if (!response.ok) {
			let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

			if (response.status === 401) {
				errorMessage +=
					" - Google Sheet may be private or authentication failed";
				console.error("❌ Google Sheets access denied. Please ensure:");
				console.error(
					"   • The Google Sheet is publicly accessible (sharing settings)",
				);
				console.error(
					"   • Or configure proper authentication (API key/service account)",
				);
			} else if (response.status === 404) {
				errorMessage += " - Google Sheet not found or invalid URL";
				console.error("❌ Google Sheet not found. Please check:");
				console.error("   • The sheet ID is correct");
				console.error("   • The sheet exists and hasn't been deleted");
				console.error("   • The range is valid (if specified)");
			} else if (response.status === 403) {
				errorMessage += " - Access forbidden, check sharing permissions";
				console.error("❌ Google Sheets access forbidden. Please check:");
				console.error("   • Sheet sharing settings allow public access");
				console.error("   • API quotas haven't been exceeded");
			}

			throw new Error(errorMessage);
		}

		const csvContent = await response.text();

		if (!csvContent || csvContent.trim().length === 0) {
			console.error("❌ Empty CSV content received from Google Sheets");
			throw new Error("Empty CSV content received");
		}

		console.log(
			`✅ Successfully fetched ${csvContent.split("\n").length - 1} rows from remote CSV`,
		);
		return csvContent;
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "AbortError") {
				console.error("❌ Google Sheets request timed out after 15 seconds");
				console.error(
					"   This may indicate network issues or a slow Google Sheets response",
				);
			} else if (
				error.name === "TypeError" &&
				error.message.includes("fetch")
			) {
				console.error("❌ Network error connecting to Google Sheets");
				console.error("   Please check your internet connection");
			}
		}
		throw error;
	}
}

/**
 * Multi-strategy CSV fetching with comprehensive fallback logic
 */
export async function fetchCSVWithFallbacks(
	remoteUrl: string | null,
	sheetId: string | null,
	range: string = "A:Z",
): Promise<CSVFetchResult> {
	const errors: CSVFetchError[] = [];

	// Strategy 1: Try public CSV URL first
	if (remoteUrl) {
		try {
			console.log("📡 Strategy 1: Attempting public CSV URL...");
			const content = await fetchRemoteCSV(remoteUrl);
			return {
				content,
				source: "remote",
				timestamp: Date.now(),
			};
		} catch (publicError) {
			const errorMsg =
				publicError instanceof Error ? publicError.message : "Unknown error";
			errors.push({ source: "Public URL", message: errorMsg });
			console.warn(`⚠️ Public CSV failed: ${errorMsg}`);
		}
	}

	// Strategy 2: Try service account authentication (handled by google-sheets module)
	const hasServiceAccount = Boolean(
				ServerEnvironmentManager.get("GOOGLE_SERVICE_ACCOUNT_KEY") ||
		ServerEnvironmentManager.get("GOOGLE_SERVICE_ACCOUNT_FILE"),
	);

	if (hasServiceAccount && sheetId) {
		try {
			console.log(
				"🔐 Strategy 2: Attempting service account authentication...",
			);
			// Use centralized Google integration
			const { GoogleCloudAPI } = await import("../google/gcp-api");
			const content = await GoogleCloudAPI.fetchEventData(sheetId, range);
			return {
				content,
				source: "remote",
				timestamp: Date.now(),
			};
		} catch (serviceAccountError) {
			const errorMsg =
				serviceAccountError instanceof Error
					? serviceAccountError.message
					: "Unknown error";
			errors.push({ source: "Service Account", message: errorMsg });
			console.warn(`⚠️ Service account authentication failed: ${errorMsg}`);
		}
	}

	// Strategy 3: Fall back to local CSV
	try {
		console.log("📁 Strategy 3: Falling back to local CSV...");
		const content = await fetchLocalCSV();
		console.log(
			`ℹ️ Using local CSV fallback (last updated: ${getCacheConfig().localCsvLastUpdated})`,
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
