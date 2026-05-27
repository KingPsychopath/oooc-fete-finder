import type { Coordinates } from "@/features/events/types";
import { GoogleCloudAPI } from "@/lib/google/api";
import { buildStructuredLocationSearchQuery } from "../location-utils";
import type { LocationResolution } from "../types";
import type { GeocodingProvider } from "./geocoding-provider";

const PARIS_BOUNDS = {
	north: 48.92,
	south: 48.8,
	east: 2.48,
	west: 2.22,
} as const;

const CONFIDENCE_BY_ACCURACY = {
	ROOFTOP: 0.95,
	RANGE_INTERPOLATED: 0.85,
	GEOMETRIC_CENTER: 0.7,
	APPROXIMATE: 0.5,
} as const;

const isWithinParisBounds = ({ lat, lng }: Coordinates): boolean =>
	lat >= PARIS_BOUNDS.south &&
	lat <= PARIS_BOUNDS.north &&
	lng >= PARIS_BOUNDS.west &&
	lng <= PARIS_BOUNDS.east;

export const createGoogleGeocodingProvider = (): GeocodingProvider => ({
	name: "google",
	isConfigured: GoogleCloudAPI.supportsGeocoding,
	geocode: async (query): Promise<LocationResolution> => {
		const searchQuery = buildStructuredLocationSearchQuery(query);
		const result = await GoogleCloudAPI.geocodeAddress(searchQuery);
		const coordinates = {
			lat: result.latitude,
			lng: result.longitude,
		};
		const confidenceBase = CONFIDENCE_BY_ACCURACY[result.accuracy] ?? 0.5;
		const confidence = Math.min(
			1,
			confidenceBase + (isWithinParisBounds(coordinates) ? 0.05 : 0),
		);

		return {
			coordinates,
			source: "geocoded",
			precision: result.accuracy === "ROOFTOP" ? "exact" : "venue",
			confidence,
			formattedAddress: result.formatted_address,
			provider: "google",
			providerPlaceId: result.place_id,
			query: searchQuery,
			lastResolvedAt: new Date().toISOString(),
		};
	},
});
