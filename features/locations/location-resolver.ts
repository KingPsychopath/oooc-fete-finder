import { log } from "@/lib/platform/logger";
import { LocationRepository } from "./location-repository";
import {
	generateLocationStorageKey,
	getArrondissementCenter,
	isCoordinateResolvableInput,
} from "./location-utils";
import { createNoopGeocodingProvider } from "./providers/geocoding-provider";
import type { GeocodingProvider } from "./providers/geocoding-provider";
import { createGoogleGeocodingProvider } from "./providers/google-geocoding-provider";
import type {
	LocationQuery,
	LocationResolution,
	LocationResolutionPolicy,
	StoredLocationResolution,
} from "./types";

const DEFAULT_POLICY: LocationResolutionPolicy = {
	allowProviderLookup: false,
	allowArrondissementFallback: false,
	forceRefresh: false,
};

const toResolution = (
	resolution: StoredLocationResolution,
): LocationResolution => ({
	coordinates: resolution.coordinates,
	source: resolution.source,
	precision: resolution.precision,
	confidence: resolution.confidence,
	formattedAddress: resolution.formattedAddress,
	provider: resolution.provider,
	providerPlaceId: resolution.providerPlaceId,
	query: resolution.query,
	lastResolvedAt: resolution.lastResolvedAt,
});

export class LocationResolver {
	constructor(
		private readonly provider: GeocodingProvider = createGoogleGeocodingProvider(),
	) {}

	static createNoop(): LocationResolver {
		return new LocationResolver(createNoopGeocodingProvider());
	}

	async resolve(
		query: LocationQuery,
		storedLocations: Map<string, StoredLocationResolution>,
		policy: Partial<LocationResolutionPolicy> = {},
	): Promise<LocationResolution> {
		const resolvedPolicy = { ...DEFAULT_POLICY, ...policy };
		const storageKey = generateLocationStorageKey(
			query.locationName,
			query.arrondissement,
		);

		if (
			!isCoordinateResolvableInput(query.locationName, query.arrondissement)
		) {
			return {
				coordinates: null,
				source: "unresolved",
				precision: "unknown",
				confidence: 0,
				query: query.locationName,
				lastResolvedAt: new Date().toISOString(),
			};
		}

		const stored = storedLocations.get(storageKey);
		if (stored && !resolvedPolicy.forceRefresh) {
			return toResolution(stored);
		}

		if (resolvedPolicy.allowProviderLookup && this.provider.isConfigured()) {
			try {
				const geocoded = await this.provider.geocode(query);
				const storedResolution = LocationRepository.toStoredResolution(
					storageKey,
					query.locationName,
					query.arrondissement,
					geocoded,
				);
				storedLocations.set(storageKey, storedResolution);
				return geocoded;
			} catch (error) {
				log.warn("locations", "Provider geocoding failed", {
					provider: this.provider.name,
					locationName: query.locationName,
					arrondissement: query.arrondissement,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		if (resolvedPolicy.allowArrondissementFallback) {
			const coordinates = getArrondissementCenter(query.arrondissement);
			if (coordinates) {
				const fallback: LocationResolution = {
					coordinates,
					source: "estimated_arrondissement",
					precision: "area",
					confidence: 0.35,
					query: query.locationName,
					lastResolvedAt: new Date().toISOString(),
				};
				storedLocations.set(
					storageKey,
					LocationRepository.toStoredResolution(
						storageKey,
						query.locationName,
						query.arrondissement,
						fallback,
					),
				);
				return fallback;
			}
		}

		if (stored) {
			return toResolution(stored);
		}

		return {
			coordinates: null,
			source: "unresolved",
			precision: "unknown",
			confidence: 0,
			query: query.locationName,
			lastResolvedAt: new Date().toISOString(),
		};
	}
}
