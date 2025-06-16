/**
 * 📊 Google Sheets API
 *
 * Handles all Google Sheets operations using service account authentication.
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
 * Cached service account credentials to avoid repeated file reads
 */
let cachedCredentials: ServiceAccountCredentials | null = null;

/**
 * Load service account credentials from environment
 */
async function loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
	// Return cached credentials if available
	if (cachedCredentials) {
		return cachedCredentials;
	}
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

		// Cache the credentials for future use
		cachedCredentials = credentials;
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
		const errorText = await tokenResponse.text();
		console.error("❌ Token exchange failed:", {
			status: tokenResponse.status,
			statusText: tokenResponse.statusText,
			body: errorText,
		});
		throw new Error(
			`Failed to get access token: ${tokenResponse.status} - ${errorText}`,
		);
	}

	const tokenData = await tokenResponse.json();
	return tokenData.access_token;
}

/**
 * Fetch sheet data using Sheets API
 */
async function fetchSheetData(
	sheetId: string,
	range: string,
	accessToken: string,
): Promise<unknown[][]> {
	console.log(`📊 Fetching sheet data: ${sheetId}, range: ${range}`);

	const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;

	const response = await fetch(sheetsUrl, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("❌ Sheets API request failed:", {
			status: response.status,
			statusText: response.statusText,
			body: errorText,
		});
		throw new Error(`Sheets API error: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
	return data.values || [];
}

/**
 * Convert sheet values to CSV format
 */
function convertToCsv(values: unknown[][]): string {
	if (!values || values.length === 0) {
		throw new Error("No data returned from Google Sheets");
	}

	return values
		.map((row) =>
			row
				.map((cell) => {
					// Handle null/undefined cells
					if (cell === null || cell === undefined) {
						return "";
					}

					// Convert to string and escape quotes
					const cellStr = String(cell);

					// If cell contains comma, newline, or quote, wrap in quotes and escape quotes
					if (
						cellStr.includes(",") ||
						cellStr.includes("\n") ||
						cellStr.includes('"')
					) {
						return `"${cellStr.replace(/"/g, '""')}"`;
					}

					return cellStr;
				})
				.join(","),
		)
		.join("\n");
}

/**
 * Fetch CSV from Google Sheets using service account authentication
 */
export async function fetchRemoteCSVWithServiceAccount(
	sheetId: string,
	range: string = "A:Z",
): Promise<string> {
	console.log("🔐 Fetching Google Sheets data via service account...");

	try {
		const credentials = await loadServiceAccountCredentials();
		const accessToken = await getAccessToken(credentials);
		const values = await fetchSheetData(sheetId, range, accessToken);
		const csvContent = convertToCsv(values);

		console.log(
			`✅ Successfully fetched ${values.length} rows from Google Sheets via service account`,
		);
		return csvContent;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error("❌ Service account fetch failed:", errorMessage);
		throw new Error(`Service account fetch failed: ${errorMessage}`);
	}
}

/**
 * Build Google Sheets CSV export URL for public sheets
 */
export function buildGoogleSheetsCSVUrl(
	sheetId: string,
	range: string = "A1:O1000",
): string {
	// For public sheets, use the export URL format
	return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&range=${encodeURIComponent(range)}`;
}

/**
 * Extract sheet ID from various Google Sheets URL formats
 */
export function extractSheetId(input: string): string | null {
	if (!input) return null;

	// Pattern to match Google Sheets ID from various URL formats
	const patterns = [
		/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
		/^([a-zA-Z0-9-_]{44})$/, // Direct sheet ID
	];

	for (const pattern of patterns) {
		const match = input.match(pattern);
		if (match) return match[1];
	}

	return null;
}

/**
 * Fetch CSV from public Google Sheets (no authentication required)
 */
export async function fetchPublicGoogleSheetsCSV(
	targetUrl: string,
): Promise<string> {
	console.log(`🌐 Fetching public Google Sheets CSV from: ${targetUrl}`);

	const response = await fetch(targetUrl, {
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch public CSV: ${response.status} ${response.statusText}`,
		);
	}

	const csvContent = await response.text();

	if (!csvContent || csvContent.trim().length === 0) {
		throw new Error("Retrieved CSV content is empty");
	}

	// Basic validation - should have at least headers
	const lines = csvContent.trim().split("\n");
	if (lines.length < 2) {
		throw new Error(
			"CSV content appears invalid - less than 2 lines (headers + data)",
		);
	}

	console.log(
		`✅ Successfully fetched ${lines.length - 1} data rows from public Google Sheets`,
	);
	return csvContent;
}

/**
 * Main Google Sheets data fetching function with multiple strategies
 */
export async function fetchGoogleSheetsData(
	remoteUrl: string | null,
	sheetId: string | null,
	range: string = "A:Z",
): Promise<GoogleSheetsFetchResult> {
	const errors: GoogleSheetsFetchError[] = [];
	const timestamp = Date.now();

	// Strategy 1: Direct URL (public sheets)
	if (remoteUrl) {
		try {
			console.log("📊 Strategy 1: Direct URL fetch");
			const content = await fetchPublicGoogleSheetsCSV(remoteUrl);
			return {
				content,
				source: "remote",
				timestamp,
				strategy: "public_url",
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			errors.push({ strategy: "Direct URL", message });
			console.warn(`⚠️ Direct URL strategy failed: ${message}`);
		}
	}

	// Strategy 2: Service account (private sheets)
	if (sheetId) {
		try {
			console.log("📊 Strategy 2: Service account fetch");
			const content = await fetchRemoteCSVWithServiceAccount(sheetId, range);
			return {
				content,
				source: "remote",
				timestamp,
				strategy: "service_account",
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			errors.push({ strategy: "Service Account", message });
			console.warn(`⚠️ Service account strategy failed: ${message}`);
		}
	}

	// All strategies failed
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
 * Google Sheets API - Unified interface
 */
export const GoogleSheetsAPI = {
	fetchSheetsData: fetchGoogleSheetsData,
	buildSheetsUrl: buildGoogleSheetsCSVUrl,
	extractSheetId,
	fetchPublicCSV: fetchPublicGoogleSheetsCSV,
	fetchWithServiceAccount: fetchRemoteCSVWithServiceAccount,
} as const;
