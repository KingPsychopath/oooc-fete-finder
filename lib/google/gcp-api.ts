/**
 * 📖 Google Cloud Platform Service Account API
 * 
 * Consolidated service account functionality for Google Sheets integration.
 * This module handles all aspects of service account authentication and data fetching.
 * 
 * Used for: Reading event data from Google Sheets
 * Auth: Service account with private key
 * Scope: spreadsheets.readonly
 */

import { env } from "@/lib/config/env";

/**
 * Service account credentials interface
 */
export interface ServiceAccountCredentials {
	client_email: string;
	private_key: string;
}

/**
 * Google Sheets fetch result interface
 */
export interface GoogleSheetsFetchResult {
	content: string;
	source: "remote";
	timestamp: number;
	strategy: "public_url" | "service_account";
}

/**
 * Google Sheets fetch error interface
 */
export interface GoogleSheetsFetchError {
	strategy: string;
	message: string;
}

/**
 * Create JWT token for Google API authentication
 */
async function createGoogleJWT(
	credentials: ServiceAccountCredentials,
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
 * Load service account credentials from environment
 */
async function loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
	const serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;
	const serviceAccountFile = env.GOOGLE_SERVICE_ACCOUNT_FILE;

	if (!serviceAccountKey && !serviceAccountFile) {
		throw new Error("No service account credentials configured");
	}

	let credentials: ServiceAccountCredentials | null = null;

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
			// Look for service account in scripts directory if no absolute path is provided
			const keyPath = path.isAbsolute(serviceAccountFile)
				? serviceAccountFile
				: path.resolve(process.cwd(), "scripts", serviceAccountFile);
			const keyContent = await fs.readFile(keyPath, "utf-8");
			credentials = JSON.parse(keyContent);
		}

		if (!credentials?.client_email || !credentials?.private_key) {
			throw new Error(
				"Invalid service account credentials - missing client_email or private_key",
			);
		}

		console.log(`✅ Service account loaded: ${credentials.client_email}`);
		return credentials;
	} catch (error) {
		console.error(
			"❌ Failed to load service account credentials:",
			error instanceof Error ? error.message : "Unknown error",
		);
		throw new Error(
			`Service account configuration error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Exchange JWT for Google API access token
 */
async function getAccessToken(
	credentials: ServiceAccountCredentials,
): Promise<string> {
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
	return accessToken;
}

/**
 * Fetch sheet data using Google Sheets API
 */
async function fetchSheetData(
	sheetId: string,
	range: string,
	accessToken: string,
): Promise<unknown[][]> {
	const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

	const sheetsResponse = await fetch(apiUrl, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!sheetsResponse.ok) {
		const errorText = await sheetsResponse.text().catch(() => "Unknown error");
		throw new Error(
			`Google Sheets API error: ${sheetsResponse.status} ${sheetsResponse.statusText} - ${errorText}`,
		);
	}

	const sheetsData = await sheetsResponse.json();
	const values = sheetsData.values || [];

	if (values.length === 0) {
		throw new Error("No data found in the specified range");
	}

	return values;
}

/**
 * Convert Google Sheets API response to CSV format
 */
function convertToCsv(values: unknown[][]): string {
	if (values.length === 0) return "";

	// Debug logging for headers
	if (values.length > 0) {
		const headers = values[0];
		console.log(
			`📊 Google Sheets API returned ${headers.length} columns:`,
			headers,
		);
		console.log(`📊 Headers: ${headers.join(", ")}`);

		// Check if Notes column is present
		const notesColIndex = headers.findIndex(
			(header: unknown) =>
				header && String(header).toLowerCase().includes("notes"),
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

	// Convert to CSV format
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

	return csvContent;
}

/**
 * Fetch CSV using Google Sheets API with service account authentication
 */
export async function fetchRemoteCSVWithServiceAccount(
	sheetId: string,
	range: string = "A:Z",
): Promise<string> {
	console.log("🔐 Attempting Google Sheets API access with service account...");

	try {
		// Load credentials and get access token
		const credentials = await loadServiceAccountCredentials();
		const accessToken = await getAccessToken(credentials);

		// Fetch sheet data
		const values = await fetchSheetData(sheetId, range, accessToken);

		// Convert to CSV format
		const csvContent = convertToCsv(values);

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
export async function fetchPublicGoogleSheetsCSV(targetUrl: string): Promise<string> {
	if (!targetUrl) {
		throw new Error("No remote CSV URL provided");
	}

	console.log(`📡 Fetching public Google Sheets CSV from: ${targetUrl.substring(0, 50)}...`);

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
			`✅ Successfully fetched ${csvContent.split("\n").length - 1} rows from public Google Sheets`,
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
 * Comprehensive Google Sheets data fetching with multiple strategies
 */
export async function fetchGoogleSheetsData(
	remoteUrl: string | null,
	sheetId: string | null,
	range: string = "A:Z",
): Promise<GoogleSheetsFetchResult> {
	const errors: GoogleSheetsFetchError[] = [];

	// Strategy 1: Try public CSV URL first
	if (remoteUrl) {
		try {
			console.log("📡 Google Strategy 1: Attempting public CSV URL...");
			const content = await fetchPublicGoogleSheetsCSV(remoteUrl);
			return {
				content,
				source: "remote",
				timestamp: Date.now(),
				strategy: "public_url",
			};
		} catch (publicError) {
			const errorMsg =
				publicError instanceof Error ? publicError.message : "Unknown error";
			errors.push({ strategy: "Public URL", message: errorMsg });
			console.warn(`⚠️ Public Google Sheets CSV failed: ${errorMsg}`);
		}
	}

	// Strategy 2: Try service account authentication
	if (sheetId && GoogleCloudAPI.hasServiceAccount()) {
		try {
			console.log(
				"🔐 Google Strategy 2: Attempting service account authentication...",
			);
			const content = await fetchRemoteCSVWithServiceAccount(sheetId, range);
			return {
				content,
				source: "remote",
				timestamp: Date.now(),
				strategy: "service_account",
			};
		} catch (serviceAccountError) {
			const errorMsg =
				serviceAccountError instanceof Error
					? serviceAccountError.message
					: "Unknown error";
			errors.push({ strategy: "Service Account", message: errorMsg });
			console.warn(`⚠️ Service account authentication failed: ${errorMsg}`);
		}
	} else if (sheetId && !GoogleCloudAPI.hasServiceAccount()) {
		console.log("🔐 Service account not configured, skipping strategy 2");
	}

	// All Google strategies failed
	console.error("💥 All Google Sheets strategies failed:");
	errors.forEach((error) =>
		console.error(`   • ${error.strategy}: ${error.message}`),
	);

	const errorMessages = errors
		.map((e) => `${e.strategy}: ${e.message}`)
		.join("; ");
	throw new Error(`All Google Sheets strategies failed: ${errorMessages}`);
}

/**
 * Google Cloud Platform API utilities
 */
export const GoogleCloudAPI = {
	/**
	 * Fetch event data using GCP Service Account
	 */
	fetchEventData: async (sheetId: string, range: string = "A:Z") => {
		return fetchRemoteCSVWithServiceAccount(sheetId, range);
	},

	/**
	 * Fetch Google Sheets data with comprehensive strategy fallback
	 */
	fetchSheetsData: async (
		remoteUrl: string | null,
		sheetId: string | null,
		range: string = "A:Z"
	): Promise<GoogleSheetsFetchResult> => {
		return fetchGoogleSheetsData(remoteUrl, sheetId, range);
	},

	/**
	 * Fetch public Google Sheets CSV data
	 */
	fetchPublicSheetsCSV: async (targetUrl: string): Promise<string> => {
		return fetchPublicGoogleSheetsCSV(targetUrl);
	},

	/**
	 * Build Google Sheets CSV export URL
	 */
	buildSheetsUrl: (sheetId: string, range: string = "A1:O1000"): string => {
		return buildGoogleSheetsCSVUrl(sheetId, range);
	},

	/**
	 * Extract sheet ID from Google Sheets URL
	 */
	extractSheetId: (input: string): string | null => {
		return extractSheetId(input);
	},

	/**
	 * Load service account credentials
	 */
	loadCredentials: async (): Promise<ServiceAccountCredentials> => {
		return loadServiceAccountCredentials();
	},

	/**
	 * Get access token using service account credentials
	 */
	getAccessToken: async (credentials: ServiceAccountCredentials): Promise<string> => {
		return getAccessToken(credentials);
	},

	/**
	 * Fetch raw sheet data (returns array of arrays)
	 */
	fetchSheetData: async (sheetId: string, range: string, accessToken: string): Promise<unknown[][]> => {
		return fetchSheetData(sheetId, range, accessToken);
	},

	/**
	 * Convert sheet data to CSV format
	 */
	convertToCsv: (values: unknown[][]): string => {
		return convertToCsv(values);
	},

	/**
	 * Check if GCP authentication is configured
	 */
	isConfigured: () => {
		return Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY ||
				env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);
	},

	/**
	 * Check if service account credentials are available
	 */
	hasServiceAccount: () => {
		return Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY ||
				env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);
	},

	/**
	 * Get configuration status
	 */
	getConfig: () => ({
		hasServiceAccount: Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY ||
				env.GOOGLE_SERVICE_ACCOUNT_FILE,
		),
		sheetId: env.GOOGLE_SHEET_ID,
		range: "A:Z", // Default range since GOOGLE_SHEET_RANGE not in env
		serviceAccountSource: env.GOOGLE_SERVICE_ACCOUNT_KEY ? "environment" : "file",
		serviceAccountFile: env.GOOGLE_SERVICE_ACCOUNT_FILE,
	}),

	/**
	 * Validate service account configuration without loading credentials
	 */
	validateConfig: () => {
		const hasKey = Boolean(env.GOOGLE_SERVICE_ACCOUNT_KEY);
		const hasFile = Boolean(env.GOOGLE_SERVICE_ACCOUNT_FILE);
		
		if (!hasKey && !hasFile) {
			return {
				valid: false,
				error: "No service account credentials configured (GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_FILE required)",
			};
		}

		if (hasKey) {
			try {
				const parsed = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY!);
				if (!parsed.client_email || !parsed.private_key) {
					return {
						valid: false,
						error: "Invalid service account JSON - missing client_email or private_key",
					};
				}
			} catch {
				return {
					valid: false,
					error: "Invalid service account JSON format",
				};
			}
		}

		return {
			valid: true,
			source: hasKey ? "environment" : "file",
		};
	},
} as const;

 