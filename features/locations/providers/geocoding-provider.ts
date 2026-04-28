import type { LocationQuery, LocationResolution } from "../types";

export interface GeocodingProvider {
	name: string;
	isConfigured: () => boolean;
	geocode: (query: LocationQuery) => Promise<LocationResolution>;
}

export const createNoopGeocodingProvider = (): GeocodingProvider => ({
	name: "none",
	isConfigured: () => false,
	geocode: async (query) => ({
		coordinates: null,
		source: "unresolved",
		precision: "unknown",
		confidence: 0,
		query: query.locationName,
		provider: "none",
		lastResolvedAt: new Date().toISOString(),
	}),
});
