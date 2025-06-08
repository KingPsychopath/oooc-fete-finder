/**
 * Google Sheets API integration
 * Handles service account authentication and data fetching from Google Sheets
 */

/**
 * Service account credentials interface
 */
interface ServiceAccountCredentials {
	client_email: string;
	private_key: string;
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
	const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
	const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

	if (!serviceAccountKey && !serviceAccountFile) {
		throw new Error("No service account credentials configured");
	}

	let credentials: ServiceAccountCredentials | null = null;

	try {
		if (serviceAccountKey) {
			console.log("🔑 Using service account from environment variable");
			credentials = JSON.parse(serviceAccountKey);
		} else if (serviceAccountFile) {
			console.log(`🔑 Reading service account from file: ${serviceAccountFile}`);
			const fs = await import("fs/promises");
			const path = await import("path");
			// Look for service account in scripts directory if no absolute path is provided
			const keyPath = path.isAbsolute(serviceAccountFile) 
				? serviceAccountFile 
				: path.resolve(process.cwd(), 'scripts', serviceAccountFile);
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
async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
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
	accessToken: string
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
		console.log(`📊 Google Sheets API returned ${headers.length} columns:`, headers);
		console.log(`📊 Headers: ${headers.join(", ")}`);

		// Check if Notes column is present
		const notesColIndex = headers.findIndex(
			(header: unknown) => header && String(header).toLowerCase().includes("notes"),
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