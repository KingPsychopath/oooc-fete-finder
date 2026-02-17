/**
 * 🗺️ Google Geocoding API
 *
 * Handles all geocoding operations using Google Maps Geocoding API.
 * The Geocoding API requires an API key (key=) in the request; it does not accept OAuth.
 */

import { env } from "@/lib/config/env";

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

function getGeocodingApiKey(): string {
	const key = env.GOOGLE_MAPS_API_KEY?.trim();
	if (!key) {
		throw new Error(
			"GOOGLE_MAPS_API_KEY is required for geocoding. Set it in your environment. See https://developers.google.com/maps/documentation/geocoding/get-api-key",
		);
	}
	return key;
}

/**
 * Geocode a single address using Google Maps Geocoding API (requires API key)
 */
async function geocodeAddressWithMapsAPI(
	address: string,
): Promise<GeocodingResult> {

	if (!address || address.trim().length === 0) {
		throw new Error("Address cannot be empty");
	}

	try {
		const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
		url.searchParams.set("address", address.trim());
		url.searchParams.set("key", getGeocodingApiKey());

		const response = await fetch(url.toString(), {
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
		const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
		url.searchParams.set("latlng", `${latitude},${longitude}`);
		url.searchParams.set("key", getGeocodingApiKey());

		const response = await fetch(url.toString(), {
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
