import type {
	Coordinates,
	EventLocation,
	ParisArrondissement,
} from "@/features/events/types";
import { PARIS_ARRONDISSEMENTS } from "@/features/events/types";
import {
	type GeocodingResult as GCPGeocodingResult,
	GoogleCloudAPI,
} from "@/lib/google/api";
import { log } from "@/lib/platform/logger";

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
			log.warn("maps.geocoding", "Geocoded location is outside Paris bounds", {
				query,
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

/** Fatal API errors: one warning per run, then use arrondissement fallback only */
let geocodingUnavailable = false;
let geocodingUnavailableLogged = false;

function isFatalGeocodingError(message: string): boolean {
	const lower = message.toLowerCase();
	return (
		lower.includes("request_denied") ||
		lower.includes("not activated") ||
		lower.includes("enable this api") ||
		lower.includes("api key") ||
		lower.includes("must use an api key") ||
		lower.includes("trial has ended") ||
		lower.includes("upgrade to a paid account") ||
		lower.includes("pay-as-you-go") ||
		lower.includes("billing") ||
		lower.includes("google_maps_api_key")
	);
}

function markGeocodingUnavailableAndWarnOnce(_message: string): void {
	geocodingUnavailable = true;
	if (geocodingUnavailableLogged) return;
	geocodingUnavailableLogged = true;
	const { log } = require("@/lib/platform/logger");
	log.warn(
		"geocoding",
		"Geocoding API unavailable — using arrondissement centre for all events. Set GOOGLE_MAPS_API_KEY and enable Geocoding API in Cloud Console to geocode addresses.",
	);
}

/**
 * Reset run state so the next populate run can try the API again.
 * Called at the start of each coordinate population run.
 */
export function resetGeocodingRunState(): void {
	geocodingUnavailable = false;
	geocodingUnavailableLogged = false;
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

export function isCoordinateResolvableInput(
	locationName: string,
	arrondissement: ParisArrondissement,
): boolean {
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

	return Boolean(hasValidLocation && hasValidArrondissement);
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
		const { forceRefresh = false, fallbackToArrondissement = true } = options;

		if (!isCoordinateResolvableInput(locationName, arrondissement)) {
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

		// Skip API for this run if we already hit a fatal error (single warning, then fallback only)
		if (geocodingUnavailable) {
			if (fallbackToArrondissement) {
				const coords = getArrondissementCenter(arrondissement);
				if (coords) {
					return {
						coordinates: coords,
						source: "estimated",
						confidence: 0.5,
						wasInStorage: false,
					};
				}
			}
			return null;
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
			const isFatal = isFatalGeocodingError(geocodingError.message);

			if (isFatal) {
				markGeocodingUnavailableAndWarnOnce(geocodingError.message);
				if (fallbackToArrondissement) {
					const coords = getArrondissementCenter(arrondissement);
					if (coords) {
						const estimatedLocation: EventLocation = {
							id: storageKey,
							name: locationName,
							arrondissement,
							coordinates: coords,
							confidence: 0.5,
							source: "estimated",
							lastUpdated: new Date().toISOString(),
						};
						storedLocations.set(storageKey, estimatedLocation);
						return {
							coordinates: coords,
							source: "estimated",
							confidence: 0.5,
							wasInStorage: false,
						};
					}
				}
				return null;
			}

			// Non-fatal (e.g. no results): log once per event is acceptable; return null or fallback
			if (fallbackToArrondissement) {
				const coords = getArrondissementCenter(arrondissement);
				if (coords) {
					const estimatedLocation: EventLocation = {
						id: storageKey,
						name: locationName,
						arrondissement,
						coordinates: coords,
						confidence: 0.5,
						source: "estimated",
						lastUpdated: new Date().toISOString(),
					};
					storedLocations.set(storageKey, estimatedLocation);
					return {
						coordinates: coords,
						source: "estimated",
						confidence: 0.5,
						wasInStorage: false,
					};
				}
			}
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
