import { revalidatePath, revalidateTag } from "next/cache";
import { parseCSVContent, convertCSVRowToEvent } from "@/utils/csvParser";
import { Event } from "@/types/events";
import { USE_CSV_DATA } from "@/data/events";

/**
 * Type utilities to ensure cache invalidation stays in sync with Event type
 * These will cause compile-time errors if Event fields are added/removed
 */
type EventFields = keyof Event;

/**
 * Utility to get all Event field names - this will break compilation
 * if new fields are added to Event type without updating cache logic
 */
const EVENT_FIELD_NAMES: EventFields[] = [
	'id', 'name', 'day', 'date', 'time', 'endTime', 'arrondissement', 
	'location', 'link', 'links', 'description', 'type', 'genre', 
	'venueTypes', 'indoor', 'verified', 'price', 'age', 'isOOOCPick', 
	'isFeatured', 'featuredAt', 'nationality', 'category'
];
void EVENT_FIELD_NAMES; // Used for compile-time checking

/**
 * Compile-time check: This will cause a TypeScript error if we miss any Event fields
 * or if the Event type gains/loses fields without updating the cache logic
 */
const _fieldCompleteness: Record<EventFields, true> = {
	id: true, name: true, day: true, date: true, time: true, endTime: true,
	arrondissement: true, location: true, link: true, links: true, description: true,
	type: true, genre: true, venueTypes: true, indoor: true, verified: true,
	price: true, age: true, isOOOCPick: true, isFeatured: true, featuredAt: true,
	nationality: true, category: true
};
void _fieldCompleteness; // Silence unused warning

// Cache configuration - can be overridden via environment variables
const CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MS || "3600000"); // 1 hour default
const REMOTE_REFRESH_INTERVAL = parseInt(
	process.env.REMOTE_REFRESH_INTERVAL_MS || "300000",
); // 5 minutes default

// Google Sheets CSV URL - configurable via environment variable
const REMOTE_CSV_URL = process.env.REMOTE_CSV_URL || "";

// Local CSV file fallback date
const LOCAL_CSV_LAST_UPDATED =
	process.env.LOCAL_CSV_LAST_UPDATED || "2025-01-18";

// Dynamic Google Sheet override (stored in memory for admin use)
let dynamicSheetId: string | null = null;
let dynamicSheetRange: string | null = null;

/**
 * Cache state - centralized in this module
 */
interface CacheState {
	events: Event[] | null;
	lastFetchTime: number;
	lastRemoteFetchTime: number;
	lastRemoteSuccessTime: number;
	lastRemoteErrorMessage: string;
	lastDataSource: "remote" | "local" | "cached";
}

const cacheState: CacheState = {
	events: null,
	lastFetchTime: 0,
	lastRemoteFetchTime: 0,
	lastRemoteSuccessTime: 0,
	lastRemoteErrorMessage: "",
	lastDataSource: "cached",
};

/**
 * Cache status interface for admin panel
 */
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
 * Events result interface
 */
export interface EventsResult {
	success: boolean;
	data: Event[];
	count: number;
	cached: boolean;
	source: "remote" | "local" | "cached";
	error?: string;
	lastUpdate?: string;
}

/**
 * Cache refresh result interface
 */
export interface CacheRefreshResult {
	success: boolean;
	message: string;
	data?: Event[];
	count?: number;
	source?: "remote" | "local" | "cached";
	error?: string;
}

/**
 * Full revalidation result interface
 */
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

/**
 * Create a JWT token for Google API authentication
 */
async function createGoogleJWT(
	credentials: { client_email: string; private_key: string },
	now: number,
): Promise<string> {
	const header = {
		alg: "RS256",
		typ: "JWT",
	};

	const payload = {
		iss: credentials.client_email,
		scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
		aud: "https://oauth2.googleapis.com/token",
		exp: now + 3600, // 1 hour
		iat: now,
	};

	// Create JWT header and payload
	const encodedHeader = btoa(JSON.stringify(header))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
	const encodedPayload = btoa(JSON.stringify(payload))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
	const unsignedToken = `${encodedHeader}.${encodedPayload}`;

	// Import crypto for RSA signing
	const crypto = await import("crypto");

	// Create signature
	const signature = crypto
		.createSign("RSA-SHA256")
		.update(unsignedToken)
		.sign(credentials.private_key, "base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	return `${unsignedToken}.${signature}`;
}

/**
 * Extract sheet ID from various Google Sheets URL formats or return if already an ID
 */
function extractSheetId(input: string): string | null {
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
 * Fetch CSV using Google Sheets API with service account authentication
 */
async function fetchRemoteCSVWithServiceAccount(
	sheetId: string,
	range: string = "A:Z",
): Promise<string> {
	console.log("🔐 Attempting Google Sheets API access with service account...");

	// Get service account credentials
	const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
	const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

	if (!serviceAccountKey && !serviceAccountFile) {
		throw new Error("No service account credentials configured");
	}

	let credentials: { client_email: string; private_key: string } | null = null;

	try {
		if (serviceAccountKey) {
			console.log("🔑 Using service account from environment variable");
			credentials = JSON.parse(serviceAccountKey);
		} else if (serviceAccountFile) {
			console.log(
				`🔑 Reading service account from file: ${serviceAccountFile}`,
			);
			const fs = await import("fs/promises");
			const path = await import("path");
			const keyPath = path.resolve(serviceAccountFile);
			const keyContent = await fs.readFile(keyPath, "utf-8");
			credentials = JSON.parse(keyContent);
		}

		if (!credentials?.client_email || !credentials?.private_key) {
			throw new Error(
				"Invalid service account credentials - missing client_email or private_key",
			);
		}

		console.log(`✅ Service account loaded: ${credentials.client_email}`);
	} catch (error) {
		console.error(
			"❌ Failed to load service account credentials:",
			error instanceof Error ? error.message : "Unknown error",
		);
		throw new Error(
			`Service account configuration error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}

	try {
		// Generate JWT token for Google API authentication
		const now = Math.floor(Date.now() / 1000);
		const jwt = await createGoogleJWT(credentials, now);

		// Exchange JWT for access token
		const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				assertion: jwt,
			}),
			signal: AbortSignal.timeout(10000),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text().catch(() => "Unknown error");
			throw new Error(
				`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`,
			);
		}

		const tokenData = await tokenResponse.json();
		const accessToken = tokenData.access_token;

		if (!accessToken) {
			throw new Error("No access token received from Google OAuth");
		}

		console.log("✅ Google API access token obtained successfully");

		// Fetch sheet data using Google Sheets API
		const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

		const sheetsResponse = await fetch(apiUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(15000),
		});

		if (!sheetsResponse.ok) {
			const errorText = await sheetsResponse
				.text()
				.catch(() => "Unknown error");
			throw new Error(
				`Google Sheets API error: ${sheetsResponse.status} ${sheetsResponse.statusText} - ${errorText}`,
			);
		}

		const sheetsData = await sheetsResponse.json();
		const values = sheetsData.values || [];

		if (values.length === 0) {
			throw new Error("No data found in the specified range");
		}

		// Debug: Log the headers to see what we're actually getting
		if (values.length > 0) {
			const headers = values[0];
			console.log(
				`📊 Google Sheets API returned ${headers.length} columns:`,
				headers,
			);
			console.log(`📊 Headers: ${headers.join(", ")}`);

			// Check if Notes column is present
			const notesColIndex = headers.findIndex(
				(header: string) => header && header.toLowerCase().includes("notes"),
			);
			if (notesColIndex >= 0) {
				console.log(
					`✅ Notes column found at index ${notesColIndex}: "${headers[notesColIndex]}"`,
				);
			} else {
				console.warn(
					`⚠️ Notes column not found in headers. Available columns: [${headers.join(", ")}]`,
				);
			}
		}

		// Get the maximum number of columns from the header row
		const maxColumns = values.length > 0 ? values[0].length : 0;
		console.log(`📊 Expected ${maxColumns} columns per row`);

		// Convert Google Sheets API response to CSV format
		const csvContent = values
			.map((row: unknown[], rowIndex: number) => {
				// Pad the row to ensure it has the same number of columns as the header
				const paddedRow = [...row];
				while (paddedRow.length < maxColumns) {
					paddedRow.push("");
				}

				// Log row length for debugging (first few rows only)
				if (rowIndex < 3) {
					console.log(
						`📊 Row ${rowIndex}: ${row.length} -> ${paddedRow.length} columns`,
					);
				}

				return paddedRow
					.map((cell: unknown) => {
						// Escape commas and quotes in CSV format
						const cellStr = String(cell || "");
						if (
							cellStr.includes(",") ||
							cellStr.includes('"') ||
							cellStr.includes("\n")
						) {
							return `"${cellStr.replace(/"/g, '""')}"`;
						}
						return cellStr;
					})
					.join(",");
			})
			.join("\n");

		console.log(
			`✅ Successfully fetched ${values.length - 1} rows from Google Sheets API`,
		);
		return csvContent;
	} catch (error) {
		console.error(
			"❌ Service account authentication failed:",
			error instanceof Error ? error.message : "Unknown error",
		);
		throw error;
	}
}

async function fetchLocalCSV(): Promise<string> {
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

function buildGoogleSheetsCSVUrl(
	sheetId: string,
	range: string = "A1:O1000",
): string {
	return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&range=${encodeURIComponent(range)}`;
}

/**
 * Original public CSV fetching function
 */
async function fetchRemoteCSV(): Promise<string> {
	const targetUrl = dynamicSheetId
		? buildGoogleSheetsCSVUrl(dynamicSheetId, dynamicSheetRange || "A:Z")
		: REMOTE_CSV_URL;

	if (!targetUrl) {
		console.error("❌ No remote CSV URL configured. Please set either:");
		console.error("   • REMOTE_CSV_URL environment variable, or");
		console.error("   • Use the admin panel to set a dynamic Google Sheet ID");
		throw new Error("No remote CSV URL configured");
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
			// Provide more specific error messages for common issues
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
			// Log more context for network errors
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
 * Smart CSV fetching with multiple fallback strategies
 */
async function fetchCSVWithFallbacks(): Promise<string> {
	const errors: string[] = [];

	// Strategy 1: Try public CSV URL first
	const publicUrl = dynamicSheetId
		? buildGoogleSheetsCSVUrl(dynamicSheetId, dynamicSheetRange || "A:Z")
		: REMOTE_CSV_URL;

	if (publicUrl) {
		try {
			console.log("📡 Strategy 1: Attempting public CSV URL...");
			return await fetchRemoteCSV();
		} catch (publicError) {
			const errorMsg =
				publicError instanceof Error ? publicError.message : "Unknown error";
			errors.push(`Public URL: ${errorMsg}`);
			console.warn(`⚠️ Public CSV failed: ${errorMsg}`);
		}
	}

	// Strategy 2: Try service account authentication
	const hasServiceAccount = Boolean(
		process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
			process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
	);
	const sheetId =
		dynamicSheetId ||
		process.env.GOOGLE_SHEET_ID ||
		extractSheetId(REMOTE_CSV_URL || "");

	if (hasServiceAccount && sheetId) {
		try {
			console.log(
				"🔐 Strategy 2: Attempting service account authentication...",
			);
			// Use a wider range to ensure we get all columns including Notes (A-N minimum, but go wider to be safe)
			const range =
				dynamicSheetRange || process.env.GOOGLE_SHEET_RANGE || "A1:O1000";
			console.log(`📊 Using Google Sheets range: ${range}`);
			return await fetchRemoteCSVWithServiceAccount(sheetId, range);
		} catch (serviceAccountError) {
			const errorMsg =
				serviceAccountError instanceof Error
					? serviceAccountError.message
					: "Unknown error";
			errors.push(`Service Account: ${errorMsg}`);
			console.warn(`⚠️ Service account authentication failed: ${errorMsg}`);
		}
	} else {
		if (!hasServiceAccount) {
			console.log("🔑 Service account not configured - skipping Strategy 2");
		}
		if (!sheetId) {
			console.log("📋 Sheet ID not available - skipping Strategy 2");
		}
	}

	// Strategy 3: Fall back to local CSV
	try {
		console.log("📁 Strategy 3: Falling back to local CSV...");
		const localCsv = await fetchLocalCSV();
		console.log(
			`ℹ️ Using local CSV fallback (last updated: ${LOCAL_CSV_LAST_UPDATED})`,
		);
		return localCsv;
	} catch (localError) {
		const errorMsg =
			localError instanceof Error ? localError.message : "Unknown error";
		errors.push(`Local CSV: ${errorMsg}`);
		console.error(`❌ Local CSV fallback failed: ${errorMsg}`);
	}

	// All strategies failed
	console.error("💥 All data fetching strategies failed:");
	errors.forEach((error) => console.error(`   • ${error}`));
	throw new Error(`All data sources failed: ${errors.join("; ")}`);
}

/**
 * Core cache management functions
 */
export class CacheManager {
	/**
	 * Get events with smart caching and fallback logic
	 */
	static async getEvents(forceRefresh: boolean = false): Promise<EventsResult> {
		try {
			const now = Date.now();

			// Return cached data if valid and not forcing refresh
			if (
				!forceRefresh &&
				cacheState.events &&
				now - cacheState.lastFetchTime < CACHE_DURATION
			) {
				console.log(
					`🔄 Using cached events data (${cacheState.events.length} events, cached ${Math.round((now - cacheState.lastFetchTime) / 1000)}s ago)`,
				);
				return {
					success: true,
					data: cacheState.events,
					count: cacheState.events.length,
					cached: true,
					source: cacheState.lastDataSource,
					lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
				};
			}

			console.log("🔄 Loading fresh events data...");
			console.log(`📊 Configuration: USE_CSV_DATA=${USE_CSV_DATA}`);

			let csvContent: string;
			const errors: string[] = [];

			// Try to fetch data based on USE_CSV_DATA flag
			if (USE_CSV_DATA) {
				console.log(
					"📡 CSV data mode enabled - attempting remote fetch with multiple strategies",
				);

				// First try remote CSV if it's time for a refresh or forced
				const shouldTryRemote =
					forceRefresh ||
					now - cacheState.lastRemoteFetchTime > REMOTE_REFRESH_INTERVAL ||
					!cacheState.events;

				if (shouldTryRemote) {
					console.log("🌐 Attempting multi-strategy data fetching...");

					try {
						csvContent = await fetchCSVWithFallbacks();
						cacheState.lastRemoteFetchTime = now;
						cacheState.lastRemoteSuccessTime = now;
						cacheState.lastRemoteErrorMessage = "";

						// Determine the actual source based on what was used
						if (csvContent.includes("local CSV fallback")) {
							console.log(
								"✅ Successfully loaded data using local CSV fallback",
							);
							cacheState.lastDataSource = "local";
						} else {
							console.log("✅ Successfully loaded data from remote source");
							cacheState.lastDataSource = "remote";
						}
					} catch (remoteError) {
						const errorMsg =
							remoteError instanceof Error
								? remoteError.message
								: "Unknown remote error";
						errors.push(`All strategies failed: ${errorMsg}`);
						cacheState.lastRemoteErrorMessage = errorMsg;
						console.error("❌ All data fetching strategies failed:", errorMsg);
						console.error("💡 To fix this issue:");
						console.error(
							"   1. Check Google Sheets configuration and permissions",
						);
						console.error(
							"   2. Ensure local CSV file exists at data/events.csv",
						);
						console.error(
							"   3. Set proper environment variables (see documentation)",
						);

						throw new Error(`All data sources failed: ${errorMsg}`);
					}
				} else {
					// Use local CSV if we're not trying remote
					console.log("📁 Using local CSV (remote not due for refresh)");
					try {
						csvContent = await fetchLocalCSV();
						console.log("✅ Successfully loaded data from local CSV");
						cacheState.lastDataSource = "local";
					} catch (localError) {
						const localErrorMsg =
							localError instanceof Error
								? localError.message
								: "Unknown local error";
						errors.push(`Local CSV failed: ${localErrorMsg}`);
						console.error("❌ Local CSV loading failed:", localErrorMsg);
						throw new Error(`Local CSV failed: ${localErrorMsg}`);
					}
				}
			} else {
				// USE_CSV_DATA is false, use local CSV
				console.log("📁 CSV remote fetching disabled (USE_CSV_DATA=false)");
				csvContent = await fetchLocalCSV();
				console.log("✅ Successfully loaded data from local CSV");
				cacheState.lastDataSource = "local";
			}

			// Parse the CSV content
			console.log("🔄 Parsing CSV content...");
			const csvRows = parseCSVContent(csvContent);
			const events: Event[] = csvRows.map((row, index) =>
				convertCSVRowToEvent(row, index),
			);

			// Update cache
			cacheState.events = events;
			cacheState.lastFetchTime = now;

			console.log(
				`✅ Successfully loaded and cached ${events.length} events from ${cacheState.lastDataSource} source`,
			);

			const result: EventsResult = {
				success: true,
				data: events,
				count: events.length,
				cached: false,
				source: cacheState.lastDataSource,
				lastUpdate: new Date(cacheState.lastFetchTime).toISOString(),
			};

			// Add error info if there were non-fatal errors
			if (errors.length > 0) {
				result.error = `Warnings: ${errors.join("; ")}`;
				console.warn("⚠️ Non-fatal errors occurred:", errors);
			}

			return result;
		} catch (error) {
			console.error("❌ Error loading CSV events:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			// If we have cached data, return it even if expired
			if (cacheState.events) {
				console.log("⚠️ Returning expired cached data due to error");
				console.log(
					`   Cached data: ${cacheState.events.length} events from ${cacheState.lastDataSource} source`,
				);
				return {
					success: true,
					data: cacheState.events,
					count: cacheState.events.length,
					cached: true,
					source: cacheState.lastDataSource,
					error: `Using cached data due to error: ${errorMessage}`,
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
				error: errorMessage,
			};
		}
	}

	/**
	 * Force refresh the events cache
	 */
	static async forceRefresh(): Promise<CacheRefreshResult> {
		try {
			console.log("🔄 Force refreshing events cache with smart invalidation...");
			const startTime = Date.now();
			
			// Get fresh data
			const result = await this.getEvents(true);
			const processingTime = Date.now() - startTime;

			if (result.success) {
				// Perform smart cache invalidation
				const invalidationResult = await CacheInvalidation.smartInvalidation(result.data);
				
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
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
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
		const now = Date.now();

		// If we have no cached data and USE_CSV_DATA is enabled, try to load some data first
		if (!cacheState.events && USE_CSV_DATA) {
			console.log(
				"🔄 No cached data found, attempting to load events for cache status...",
			);
			try {
				await this.getEvents(false);
			} catch (error) {
				console.log(
					"⚠️ Failed to load events for cache status:",
					error instanceof Error ? error.message : "Unknown error",
				);
			}
		}

		// Check if any remote configuration is available
		const remoteConfigured = Boolean(
			REMOTE_CSV_URL ||
				process.env.GOOGLE_SHEETS_API_KEY ||
				process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
				process.env.GOOGLE_SERVICE_ACCOUNT_FILE ||
				dynamicSheetId,
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
			cacheAge: cacheState.lastFetchTime ? now - cacheState.lastFetchTime : 0,
			nextRemoteCheck: cacheState.lastRemoteFetchTime
				? Math.max(
						0,
						REMOTE_REFRESH_INTERVAL - (now - cacheState.lastRemoteFetchTime),
					)
				: 0,
			dataSource: cacheState.lastDataSource,
			useCsvData: USE_CSV_DATA,
			eventCount: cacheState.events?.length || 0,
			localCsvLastUpdated: LOCAL_CSV_LAST_UPDATED,
			remoteConfigured,
		};
	}

	/**
	 * Complete revalidation - refresh cache AND invalidate page cache with enhanced clearing
	 */
	static async fullRevalidation(
		path: string = "/",
	): Promise<FullRevalidationResult> {
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
					console.log(`✅ Step 1: Successfully refreshed events cache with invalidation`);
				} else {
					console.warn("⚠️ Step 1: Failed to refresh events cache");
				}
			} catch (cacheError) {
				const cacheErrorMessage =
					cacheError instanceof Error ? cacheError.message : "Unknown error";
				console.error(
					"❌ Step 1: Error refreshing events cache:",
					cacheErrorMessage,
				);
				details.cacheError = cacheErrorMessage;
			}

			// Step 2: Comprehensive cache clearing for additional paths
			try {
				console.log(`🔄 Step 2: Performing comprehensive cache clearing...`);
				const paths = [path];
				
				// Add common paths that might need clearing
				if (path === "/") {
					paths.push("/events", "/admin");
				}
				
				const clearResult = await CacheInvalidation.clearAllCaches(paths);
				
				if (clearResult.success) {
					pageRevalidated = true;
					console.log(`✅ Step 2: Successfully cleared all cache layers for paths: ${clearResult.clearedPaths.join(", ")}`);
				} else {
					console.warn(`⚠️ Step 2: Cache clearing had errors: ${clearResult.errors.join("; ")}`);
					// Still consider it partially successful if some paths were cleared
					pageRevalidated = clearResult.clearedPaths.length > 0;
				}
				
				details.revalidationError = clearResult.errors.length > 0 ? clearResult.errors.join("; ") : undefined;
			} catch (revalidationError) {
				const revalidationErrorMessage =
					revalidationError instanceof Error
						? revalidationError.message
						: "Unknown error";
				console.error(
					"❌ Step 2: Error in comprehensive cache clearing:",
					revalidationErrorMessage,
				);
				details.revalidationError = revalidationErrorMessage;
			}

			const endTime = Date.now();
			const duration = endTime - startTime;

			return {
				success: cacheRefreshed || pageRevalidated, // Success if at least one operation succeeded
				message: `Enhanced full revalidation completed in ${duration}ms. Cache: ${cacheRefreshed ? "refreshed" : "failed"}, Pages: ${pageRevalidated ? "cleared" : "failed"}`,
				cacheRefreshed,
				pageRevalidated,
				details,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
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
	 * Dynamic sheet configuration management
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
				dynamicSheetId = null;
				dynamicSheetRange = null;
				return {
					success: true,
					message:
						"Dynamic sheet override cleared - using environment variables",
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
			dynamicSheetId = extractedId;
			dynamicSheetRange = (range && range.trim()) || "A:Z";

			console.log(
				`🔄 Dynamic Google Sheet set: ${dynamicSheetId} (Range: ${dynamicSheetRange})`,
			);

			return {
				success: true,
				message: `Dynamic sheet override set successfully`,
				sheetId: dynamicSheetId,
				range: dynamicSheetRange,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Error setting dynamic sheet:", errorMessage);
			return {
				success: false,
				message: `Error: ${errorMessage}`,
			};
		}
	}

	static getDynamicSheetConfig(): {
		sheetId: string | null;
		range: string | null;
		isActive: boolean;
	} {
		return {
			sheetId: dynamicSheetId,
			range: dynamicSheetRange,
			isActive: dynamicSheetId !== null,
		};
	}

	/**
	 * Clear all cache data (useful for testing or admin operations)
	 */
	static clearCache(): void {
		cacheState.events = null;
		cacheState.lastFetchTime = 0;
		cacheState.lastRemoteFetchTime = 0;
		cacheState.lastRemoteSuccessTime = 0;
		cacheState.lastRemoteErrorMessage = "";
		cacheState.lastDataSource = "cached";
		console.log("🗑️ Cache cleared");
	}
}

/**
 * Enhanced cache invalidation utilities
 */
export class CacheInvalidation {
	/**
	 * Clear all cache layers - both in-memory and Next.js page cache
	 */
	static async clearAllCaches(paths: string[] = ["/"]): Promise<{
		success: boolean;
		clearedPaths: string[];
		errors: string[];
	}> {
		console.log("🧹 Starting comprehensive cache clearing...");
		const clearedPaths: string[] = [];
		const errors: string[] = [];

		// Step 1: Clear in-memory cache
		try {
			CacheManager.clearCache();
			console.log("✅ In-memory cache cleared");
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			errors.push(`In-memory cache: ${errorMsg}`);
			console.error("❌ Failed to clear in-memory cache:", errorMsg);
		}

		// Step 2: Clear Next.js page cache for specified paths
		for (const path of paths) {
			try {
				revalidatePath(path, "page");
				clearedPaths.push(path);
				console.log(`✅ Page cache cleared for: ${path}`);
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error";
				errors.push(`Page cache ${path}: ${errorMsg}`);
				console.error(`❌ Failed to clear page cache for ${path}:`, errorMsg);
			}
		}

		// Step 3: Clear layout cache more aggressively
		try {
			revalidatePath("/", "layout");
			revalidatePath("/events", "layout");
			revalidatePath("/admin", "layout");
			console.log("✅ Layout cache cleared for multiple paths");
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			errors.push(`Layout cache: ${errorMsg}`);
			console.error("❌ Failed to clear layout cache:", errorMsg);
		}

		// Step 4: Clear cache tags (if we implement them later)
		try {
			revalidateTag("events");
			revalidateTag("events-data");
			console.log("✅ Cache tags cleared");
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			errors.push(`Cache tags: ${errorMsg}`);
			console.error("❌ Failed to clear cache tags:", errorMsg);
		}

		const success = errors.length === 0;
		console.log(`🧹 Cache clearing completed. Success: ${success}`);
		
		return {
			success,
			clearedPaths,
			errors,
		};
	}

	/**
	 * Emergency cache bust - immediately invalidate everything
	 */
	static async emergencyCacheBust(): Promise<{
		success: boolean;
		message: string;
		operations: string[];
		errors: string[];
	}> {
		console.log("🚨 Performing emergency cache bust...");
		const operations: string[] = [];
		const errors: string[] = [];

		try {
			// Clear all cache layers
			const clearResult = await this.clearAllCaches(["/", "/events", "/admin", "/api"]);
			
			if (clearResult.success) {
				operations.push(`Cache cleared for paths: ${clearResult.clearedPaths.join(", ")}`);
			} else {
				errors.push(...clearResult.errors);
			}

			// Additional aggressive clearing
			try {
				revalidatePath("/", "layout");
				operations.push("Layout cache cleared");
			} catch (error) {
				errors.push(`Layout cache error: ${error instanceof Error ? error.message : "Unknown"}`);
			}

			// Force reset cache timestamps
			try {
				CacheManager.clearCache();
				operations.push("Cache state reset");
			} catch (error) {
				errors.push(`Cache reset error: ${error instanceof Error ? error.message : "Unknown"}`);
			}

			const success = errors.length === 0;
			const message = success 
				? "Emergency cache bust completed successfully"
				: `Emergency cache bust completed with ${errors.length} errors`;

			console.log(`🚨 Emergency cache bust result: ${message}`);
			
			return {
				success,
				message,
				operations,
				errors,
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			console.error("❌ Emergency cache bust failed:", errorMsg);
			
			return {
				success: false,
				message: "Emergency cache bust failed",
				operations,
				errors: [errorMsg],
			};
		}
	}

	/**
	 * Type-safe normalization of event data for consistent hashing
	 * This function automatically includes ALL Event fields and will cause
	 * compile-time errors if the Event type changes
	 */
	static normalizeEventForHashing(event: Event): Event {
		// TypeScript will enforce that ALL Event fields are handled here
		// If you add/remove fields from Event type, this will break compilation
		const normalized: Event = {
			id: event.id,
			name: event.name,
			day: event.day,
			date: event.date,
			time: event.time,
			endTime: event.endTime,
			arrondissement: event.arrondissement,
			location: event.location,
			link: event.link,
			links: event.links ? [...event.links].sort() : undefined,
			description: event.description,
			type: event.type,
			genre: [...event.genre].sort(), // Sort for consistency
			venueTypes: [...event.venueTypes].sort(), // Sort for consistency
			indoor: event.indoor, // Legacy field
			verified: event.verified,
			price: event.price,
			age: event.age,
			isOOOCPick: event.isOOOCPick,
			isFeatured: event.isFeatured,
			featuredAt: event.featuredAt,
			nationality: event.nationality ? [...event.nationality].sort() : undefined,
			category: event.category, // Legacy field
		};

		return normalized;
	}

	/**
	 * Create a comprehensive, type-safe hash of event data for change detection
	 * This method automatically handles ALL Event fields and will break compilation
	 * if new fields are added to the Event type without updating this logic
	 */
	static createEventHash(events: Event[]): string {
		// Sort events by id to avoid order-based false positives
		const sortedEvents = [...events].sort((a, b) => a.id.localeCompare(b.id));
		
		// Create hash from ALL Event fields using type-safe normalization
		const hashData = sortedEvents.map(event => this.normalizeEventForHashing(event));
		
		return JSON.stringify(hashData);
	}

	/**
	 * Detailed change detection - identifies what exactly changed
	 */
	static detectChanges(oldEvents: Event[], newEvents: Event[]): {
		hasChanges: boolean;
		changeDetails: {
			countChanged: boolean;
			addedEvents: string[];
			removedEvents: string[];
			modifiedEvents: string[];
		};
	} {
		const changeDetails = {
			countChanged: oldEvents.length !== newEvents.length,
			addedEvents: [] as string[],
			removedEvents: [] as string[],
			modifiedEvents: [] as string[],
		};

		// Create maps for efficient lookup
		const oldEventMap = new Map(oldEvents.map(e => [e.id, e]));
		const newEventMap = new Map(newEvents.map(e => [e.id, e]));

		// Find removed events
		for (const oldEvent of oldEvents) {
			if (!newEventMap.has(oldEvent.id)) {
				changeDetails.removedEvents.push(oldEvent.name);
			}
		}

		// Find added and modified events
		for (const newEvent of newEvents) {
			const oldEvent = oldEventMap.get(newEvent.id);
			
			if (!oldEvent) {
				// New event
				changeDetails.addedEvents.push(newEvent.name);
			} else {
				// Check if existing event was modified
				const oldHash = this.createEventHash([oldEvent]);
				const newHash = this.createEventHash([newEvent]);
				
				if (oldHash !== newHash) {
					changeDetails.modifiedEvents.push(newEvent.name);
				}
			}
		}

		const hasChanges = changeDetails.countChanged || 
			changeDetails.addedEvents.length > 0 || 
			changeDetails.removedEvents.length > 0 || 
			changeDetails.modifiedEvents.length > 0;

		return { hasChanges, changeDetails };
	}

	/**
	 * Smart cache invalidation with detailed change detection
	 */
	static async smartInvalidation(
		newData: Event[],
		paths: string[] = ["/"],
	): Promise<{
		success: boolean;
		dataChanged: boolean;
		invalidated: boolean;
		message: string;
		changeDetails?: {
			countChanged: boolean;
			addedEvents: string[];
			removedEvents: string[];
			modifiedEvents: string[];
		};
	}> {
		console.log("🔍 Performing enhanced smart cache invalidation check...");

		// Compare with current cached data
		const currentData = cacheState.events;
		let dataChanged = false;
		let changeDetails;

		if (!currentData) {
			dataChanged = true;
			console.log("📊 No cached data exists - invalidation needed");
		} else {
			// DEBUG: Log data details for investigation
			console.log(`🔍 DEBUG: Comparing data...`);
			console.log(`   Current cache: ${currentData.length} events`);
			console.log(`   New data: ${newData.length} events`);
			
			// Sample first few events for debugging
			if (currentData.length > 0 && newData.length > 0) {
				console.log(`🔍 DEBUG: First event comparison:`);
				const firstOld = currentData[0];
				const firstNew = newData[0];
				console.log(`   Old: id="${firstOld.id}", name="${firstOld.name}", location="${firstOld.location}"`);
				console.log(`   New: id="${firstNew.id}", name="${firstNew.name}", location="${firstNew.location}"`);
			}

			// Perform detailed change detection
			const changeResult = this.detectChanges(currentData, newData);
			dataChanged = changeResult.hasChanges;
			changeDetails = changeResult.changeDetails;

			if (dataChanged) {
				console.log("📊 Data changes detected - performing cache invalidation");
				const clearResult = await this.clearAllCaches(paths);
				
				return {
					success: clearResult.success,
					dataChanged: true,
					invalidated: clearResult.success,
					message: clearResult.success 
						? `Cache invalidated due to data changes. Cleared paths: ${clearResult.clearedPaths.join(", ")}`
						: `Cache invalidation failed: ${clearResult.errors.join("; ")}`,
					changeDetails,
				};
			} else {
				console.log("📊 No data changes detected - forcing cache clear anyway (ISR fix)");
				
				// FORCE cache clear even when no changes detected to fix ISR issues
				const clearResult = await this.clearAllCaches(paths);
				
				return {
					success: clearResult.success,
					dataChanged: false,
					invalidated: clearResult.success,
					message: clearResult.success 
						? `Forced cache invalidation completed (ISR refresh). Cleared paths: ${clearResult.clearedPaths.join(", ")}`
						: `Forced cache invalidation failed: ${clearResult.errors.join("; ")}`,
				};
			}
		}

		// Fallback return (should never reach here)
		return {
			success: false,
			dataChanged: false,
			invalidated: false,
			message: "Unexpected error in cache invalidation",
		};
	}
}
