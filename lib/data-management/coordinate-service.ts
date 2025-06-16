import {
	type GeocodingResult as GCPGeocodingResult,
	GoogleCloudAPI,
} from "@/lib/google/api";
import type {
	Coordinates,
	EventLocation,
	ParisArrondissement,
} from "@/types/events";
import { PARIS_ARRONDISSEMENTS } from "@/types/events";

/**
 * Enhanced geocoding error for data management
 */
export type GeocodingError = {
	message: string;
	type:
		| "API_ERROR"
		| "NO_RESULTS"
		| "RATE_LIMIT"
		| "NETWORK_ERROR"
		| "PARSE_ERROR"
		| "CONFIG_ERROR";
	address?: string;
};

/**
 * Paris-specific geocoding request
 */
export type GeocodingRequest = {
	locationName: string;
	arrondissement: ParisArrondissement;
	region?: string;
};

/**
 * Enhanced geocoding result with Paris-specific confidence scoring
 */
export type ParisGeocodingResult = {
	coordinates: Coordinates;
	confidence: number;
	formattedAddress: string;
	placeId: string;
	accuracy:
		| "ROOFTOP"
		| "RANGE_INTERPOLATED"
		| "GEOMETRIC_CENTER"
		| "APPROXIMATE";
};

/**
 * Configuration for Paris-specific geocoding
 */
const PARIS_GEOCODING_CONFIG = {
	parisCenter: { lat: 48.8566, lng: 2.3522 },
	confidenceThresholds: {
		ROOFTOP: 0.95,
		RANGE_INTERPOLATED: 0.85,
		GEOMETRIC_CENTER: 0.7,
		APPROXIMATE: 0.5,
	},
	bounds: {
		north: 48.92,
		south: 48.8,
		east: 2.48,
		west: 2.22,
	},
} as const;

/**
 * Build a comprehensive search query for Paris locations
 */
function buildParisSearchQuery(request: GeocodingRequest): string {
	const { locationName, arrondissement } = request;

	let query = locationName.trim();

	// Add arrondissement context if not "unknown"
	if (arrondissement !== "unknown" && typeof arrondissement === "number") {
		query += `, ${arrondissement}e arrondissement, Paris, France`;
	} else {
		query += ", Paris, France";
	}

	return query;
}

/**
 * Calculate Paris-specific confidence score
 */
function calculateParisConfidence(
	result: GCPGeocodingResult,
	arrondissement: ParisArrondissement,
): number {
	const baseConfidence =
		PARIS_GEOCODING_CONFIG.confidenceThresholds[result.accuracy] || 0.3;

	let confidenceBoost = 0;

	// Boost confidence if coordinates are within Paris bounds
	if (isWithinParisBounds({ lat: result.latitude, lng: result.longitude })) {
		confidenceBoost += 0.1;
	}

	// Additional boost for specific arrondissement matches (based on formatted address)
	if (
		arrondissement !== "unknown" &&
		result.formatted_address.includes(`${arrondissement}e`)
	) {
		confidenceBoost += 0.1;
	}

	return Math.min(1.0, baseConfidence + confidenceBoost);
}

/**
 * Validate that coordinates are within reasonable Paris bounds
 */
function isWithinParisBounds(coordinates: Coordinates): boolean {
	const { lat, lng } = coordinates;
	const { bounds } = PARIS_GEOCODING_CONFIG;

	return (
		lat >= bounds.south &&
		lat <= bounds.north &&
		lng >= bounds.west &&
		lng <= bounds.east
	);
}

/**
 * Get arrondissement center coordinates as fallback
 */
export function getArrondissementCenter(
	arrondissement: ParisArrondissement,
): Coordinates | null {
	const arr = PARIS_ARRONDISSEMENTS.find((a) => a.id === arrondissement);

	if (arr) {
		return {
			lat: arr.coordinates.lat,
			lng: arr.coordinates.lng,
		};
	}

	return PARIS_GEOCODING_CONFIG.parisCenter;
}

/**
 * Geocode a Paris location using the unified GoogleCloudAPI
 */
export async function geocodeLocation(
	request: GeocodingRequest,
): Promise<ParisGeocodingResult> {
	const query = buildParisSearchQuery(request);

	try {
		const result = await GoogleCloudAPI.geocodeAddress(query);

		// Validate coordinates are within Paris bounds
		if (!isWithinParisBounds({ lat: result.latitude, lng: result.longitude })) {
			console.warn(`Geocoded location "${query}" is outside Paris bounds:`, {
				lat: result.latitude,
				lng: result.longitude,
			});
		}

		const confidence = calculateParisConfidence(result, request.arrondissement);

		return {
			coordinates: { lat: result.latitude, lng: result.longitude },
			confidence,
			formattedAddress: result.formatted_address,
			placeId: result.place_id,
			accuracy: result.accuracy,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown geocoding error";

		// Map GCP API errors to our error format
		let type: GeocodingError["type"] = "API_ERROR";
		if (message.includes("No geocoding results")) {
			type = "NO_RESULTS";
		} else if (message.includes("quota") || message.includes("limit")) {
			type = "RATE_LIMIT";
		} else if (message.includes("network") || message.includes("timeout")) {
			type = "NETWORK_ERROR";
		} else if (
			message.includes("credentials") ||
			message.includes("authentication")
		) {
			type = "CONFIG_ERROR";
		}

		throw {
			message,
			type,
			address: query,
		} as GeocodingError;
	}
}

/**
 * Generate a storage key for location lookup
 */
function generateLocationKey(
	locationName: string,
	arrondissement: ParisArrondissement,
): string {
	const cleanName = locationName.toLowerCase().trim().replace(/\s+/g, "_");
	return `${cleanName}_${arrondissement}`;
}

/**
 * Result from coordinate lookup
 */
export type CoordinateResult = {
	coordinates: Coordinates;
	source: EventLocation["source"];
	confidence: number;
	wasInStorage: boolean;
};

/**
 * Coordinate Service - Handles coordinate business logic only
 */
export class CoordinateService {
	/**
	 * Get coordinates for a single location
	 */
	static async getCoordinates(
		locationName: string,
		arrondissement: ParisArrondissement,
		storedLocations: Map<string, EventLocation>,
		options: {
			fallbackToArrondissement?: boolean;
			forceRefresh?: boolean;
		} = {},
	): Promise<CoordinateResult | null> {
		const { forceRefresh = false } = options;

		// STRICT VALIDATION: Both arrondissement and location must be valid
		// If either is missing/invalid, return null (no coordinates at all)
		const hasValidLocation =
			locationName &&
			locationName.trim() !== "" &&
			locationName !== "TBA" &&
			locationName !== "TBC" &&
			locationName.toLowerCase() !== "location tbc" &&
			locationName.toLowerCase() !== "location tba";

		const hasValidArrondissement =
			arrondissement &&
			arrondissement !== "unknown" &&
			typeof arrondissement === "number" &&
			arrondissement >= 1 &&
			arrondissement <= 20;

		// If either location or arrondissement is invalid, return null
		if (!hasValidLocation || !hasValidArrondissement) {
			console.log(
				`🚫 Skipping coordinates for "${locationName}" (arr: ${arrondissement}) - missing required data`,
			);
			return null;
		}

		const storageKey = generateLocationKey(locationName, arrondissement);

		// Check stored locations first (unless forcing refresh)
		if (!forceRefresh && storedLocations.has(storageKey)) {
			const stored = storedLocations.get(storageKey)!;
			return {
				coordinates: stored.coordinates,
				source: stored.source,
				confidence: stored.confidence || 0.5,
				wasInStorage: true,
			};
		}

		// Try geocoding with unified GCP API
		try {
			const geocodingRequest: GeocodingRequest = {
				locationName,
				arrondissement,
			};

			const result = await geocodeLocation(geocodingRequest);

			// Create location record for storage
			const eventLocation: EventLocation = {
				id: storageKey,
				name: locationName,
				arrondissement,
				coordinates: result.coordinates,
				confidence: result.confidence,
				source: "geocoded",
				lastUpdated: new Date().toISOString(),
			};

			// Add to storage map
			storedLocations.set(storageKey, eventLocation);

			return {
				coordinates: result.coordinates,
				source: "geocoded",
				confidence: result.confidence,
				wasInStorage: false,
			};
		} catch (error) {
			const geocodingError = error as GeocodingError;
			console.log(
				`❌ Geocoding failed for "${locationName}" (arr: ${arrondissement}): ${geocodingError.message}`,
			);

			// NO FALLBACK: If we can't geocode a valid location+arrondissement, return null
			// This ensures events without proper location data don't get coordinates
			return null;
		}
	}

	/**
	 * Set manual coordinates for a location
	 */
	static setManualCoordinates(
		locationName: string,
		arrondissement: ParisArrondissement,
		coordinates: Coordinates,
		storedLocations: Map<string, EventLocation>,
		confidence: number = 1.0,
	): void {
		const storageKey = generateLocationKey(locationName, arrondissement);

		const eventLocation: EventLocation = {
			id: storageKey,
			name: locationName,
			arrondissement,
			coordinates,
			confidence,
			source: "manual",
			lastUpdated: new Date().toISOString(),
		};

		storedLocations.set(storageKey, eventLocation);
	}

	/**
	 * Get statistics about stored locations
	 */
	static getStats(storedLocations: Map<string, EventLocation>): {
		totalLocations: number;
		sourceBreakdown: Record<EventLocation["source"], number>;
		lastUpdated?: string;
	} {
		const locations = Array.from(storedLocations.values());

		const sourceBreakdown = locations.reduce(
			(acc, location) => {
				acc[location.source] = (acc[location.source] || 0) + 1;
				return acc;
			},
			{} as Record<EventLocation["source"], number>,
		);

		const lastUpdated =
			locations.length > 0
				? Math.max(...locations.map((l) => new Date(l.lastUpdated).getTime()))
				: undefined;

		return {
			totalLocations: locations.length,
			sourceBreakdown,
			lastUpdated: lastUpdated
				? new Date(lastUpdated).toISOString()
				: undefined,
		};
	}
}
