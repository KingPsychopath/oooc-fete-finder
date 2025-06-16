/**
 * 🗺️ Google Geocoding API
 *
 * Handles all geocoding operations using Google Maps API.
 * Used for: Converting addresses to coordinates
 * Auth: Service account with private key
 * Scope: cloud-platform
 */

import { env } from "@/lib/config/env";
import type { ServiceAccountCredentials } from "../sheets/api";

/**
 * Geocoding result interface
 */
export interface GeocodingResult {
	address: string;
	latitude: number;
	longitude: number;
	formatted_address: string;
	place_id: string;
	accuracy:
		| "APPROXIMATE"
		| "GEOMETRIC_CENTER"
		| "RANGE_INTERPOLATED"
		| "ROOFTOP";
	location_type: string;
}

/**
 * Geocoding error interface
 */
export interface GeocodingError {
	address: string;
	status: string;
	message: string;
}

/**
 * Geocoding batch result interface
 */
export interface GeocodingBatchResult {
	successful: GeocodingResult[];
	failed: GeocodingError[];
	total: number;
	successRate: number;
}

/**
 * Create JWT token for Google API authentication (geocoding scope)
 */
async function createGeocodingJWT(
	credentials: ServiceAccountCredentials,
	now: number,
): Promise<string> {
	const header = {
		alg: "RS256",
		typ: "JWT",
	};

	const payload = {
		iss: credentials.client_email,
		scope: "https://www.googleapis.com/auth/cloud-platform",
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
 * Get access token for geocoding API
 */
async function getGeocodingAccessToken(
	credentials: ServiceAccountCredentials,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const jwt = await createGeocodingJWT(credentials, now);

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
		throw new Error(
			`Failed to get geocoding access token: ${tokenResponse.status} - ${errorText}`,
		);
	}

	const tokenData = await tokenResponse.json();
	return tokenData.access_token;
}

/**
 * Load service account credentials (shared with sheets API)
 */
async function loadServiceAccountCredentials(): Promise<ServiceAccountCredentials> {
	const serviceAccountKey = env.GOOGLE_SERVICE_ACCOUNT_KEY;
	const serviceAccountFile = env.GOOGLE_SERVICE_ACCOUNT_FILE;

	if (!serviceAccountKey && !serviceAccountFile) {
		throw new Error("No service account credentials configured for geocoding");
	}

	let credentials: ServiceAccountCredentials | null = null;

	try {
		if (serviceAccountKey) {
			credentials = JSON.parse(serviceAccountKey);
		} else if (serviceAccountFile) {
			const fs = await import("fs/promises");
			const path = await import("path");
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

		return credentials;
	} catch (error) {
		throw new Error(
			`Service account configuration error: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Geocode a single address using Google Maps API
 */
async function geocodeAddressWithMapsAPI(
	address: string,
): Promise<GeocodingResult> {
	console.log(`🗺️ Geocoding address: ${address}`);

	if (!address || address.trim().length === 0) {
		throw new Error("Address cannot be empty");
	}

	try {
		const credentials = await loadServiceAccountCredentials();
		const accessToken = await getGeocodingAccessToken(credentials);

		const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
		url.searchParams.set("address", address.trim());
		url.searchParams.set("key", ""); // Using service account token instead

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			throw new Error(
				`Geocoding API error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		if (data.status === "ZERO_RESULTS") {
			throw new Error(`No geocoding results found for address: ${address}`);
		}

		if (data.status !== "OK") {
			throw new Error(
				`Geocoding API error: ${data.status} - ${data.error_message || "Unknown error"}`,
			);
		}

		const result = data.results[0];
		if (!result) {
			throw new Error(`No geocoding results found for address: ${address}`);
		}

		const location = result.geometry.location;
		const accuracy = result.geometry.location_type || "APPROXIMATE";

		return {
			address: address.trim(),
			latitude: location.lat,
			longitude: location.lng,
			formatted_address: result.formatted_address,
			place_id: result.place_id,
			accuracy: accuracy as GeocodingResult["accuracy"],
			location_type: accuracy,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown geocoding error";
		console.error(`❌ Geocoding failed for "${address}":`, errorMessage);
		throw new Error(`Geocoding failed: ${errorMessage}`);
	}
}

/**
 * Geocode multiple addresses with batch optimization
 */
async function geocodeAddressesBatchOptimized(
	addresses: string[],
	options: {
		maxRetries?: number;
		delayMs?: number;
		batchSize?: number;
	} = {},
): Promise<GeocodingBatchResult> {
	const { maxRetries = 2, delayMs = 100, batchSize = 10 } = options;

	const successful: GeocodingResult[] = [];
	const failed: GeocodingError[] = [];
	const total = addresses.length;

	console.log(
		`🗺️ Starting batch geocoding for ${total} addresses (batch size: ${batchSize})`,
	);

	// Process addresses in batches to respect rate limits
	for (let i = 0; i < addresses.length; i += batchSize) {
		const batch = addresses.slice(i, i + batchSize);

		console.log(
			`📍 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)} (${batch.length} addresses)`,
		);

		// Process batch in parallel
		const batchPromises = batch.map(async (address) => {
			let retries = 0;

			while (retries <= maxRetries) {
				try {
					const result = await geocodeAddressWithMapsAPI(address);
					return { success: true, result };
				} catch (error) {
					retries++;
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error";

					if (retries <= maxRetries) {
						console.warn(
							`⚠️ Retry ${retries}/${maxRetries} for "${address}": ${errorMessage}`,
						);
						// Exponential backoff
						await new Promise((resolve) =>
							setTimeout(resolve, delayMs * Math.pow(2, retries - 1)),
						);
					} else {
						return {
							success: false,
							error: {
								address,
								status: "FAILED",
								message: errorMessage,
							},
						};
					}
				}
			}
		});

		const batchResults = await Promise.all(batchPromises);

		// Categorize results
		for (const batchResult of batchResults) {
			if (batchResult && batchResult.success && batchResult.result) {
				successful.push(batchResult.result);
			} else if (batchResult && !batchResult.success && batchResult.error) {
				failed.push(batchResult.error);
			}
		}

		// Delay between batches to respect rate limits
		if (i + batchSize < addresses.length) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	const successRate = total > 0 ? successful.length / total : 0;
	console.log(
		`✅ Batch geocoding completed: ${successful.length}/${total} successful (${Math.round(successRate * 100)}%)`,
	);

	return {
		successful,
		failed,
		total,
		successRate,
	};
}

/**
 * Reverse geocode coordinates to address
 */
async function reverseGeocodeWithMapsAPI(
	latitude: number,
	longitude: number,
): Promise<GeocodingResult> {
	console.log(`🗺️ Reverse geocoding coordinates: ${latitude}, ${longitude}`);

	try {
		const credentials = await loadServiceAccountCredentials();
		const accessToken = await getGeocodingAccessToken(credentials);

		const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
		url.searchParams.set("latlng", `${latitude},${longitude}`);

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			throw new Error(
				`Reverse geocoding API error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		if (data.status === "ZERO_RESULTS") {
			throw new Error(
				`No reverse geocoding results found for coordinates: ${latitude}, ${longitude}`,
			);
		}

		if (data.status !== "OK") {
			throw new Error(
				`Reverse geocoding API error: ${data.status} - ${data.error_message || "Unknown error"}`,
			);
		}

		const result = data.results[0];
		if (!result) {
			throw new Error(
				`No reverse geocoding results found for coordinates: ${latitude}, ${longitude}`,
			);
		}

		const location = result.geometry.location;
		const accuracy = result.geometry.location_type || "APPROXIMATE";

		return {
			address: result.formatted_address,
			latitude: location.lat,
			longitude: location.lng,
			formatted_address: result.formatted_address,
			place_id: result.place_id,
			accuracy: accuracy as GeocodingResult["accuracy"],
			location_type: accuracy,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error
				? error.message
				: "Unknown reverse geocoding error";
		console.error(
			`❌ Reverse geocoding failed for ${latitude}, ${longitude}:`,
			errorMessage,
		);
		throw new Error(`Reverse geocoding failed: ${errorMessage}`);
	}
}

/**
 * Google Geocoding API - Unified interface
 */
export const GoogleGeocodingAPI = {
	geocodeAddress: geocodeAddressWithMapsAPI,
	geocodeAddressesBatch: geocodeAddressesBatchOptimized,
	reverseGeocode: reverseGeocodeWithMapsAPI,
} as const;
