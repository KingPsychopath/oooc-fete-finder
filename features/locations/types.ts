import type {
	Coordinates,
	ParisArrondissement,
} from "@/features/events/types";

export type LocationResolutionSource =
	| "manual"
	| "geocoded"
	| "estimated_arrondissement"
	| "unresolved";

export type LocationResolutionPrecision =
	| "exact"
	| "venue"
	| "area"
	| "unknown";

export interface LocationQuery {
	locationName: string;
	arrondissement: ParisArrondissement;
	region?: string;
}

export interface LocationResolution {
	coordinates: Coordinates | null;
	source: LocationResolutionSource;
	precision: LocationResolutionPrecision;
	confidence: number;
	formattedAddress?: string;
	provider?: string;
	providerPlaceId?: string;
	query?: string;
	lastResolvedAt?: string;
}

export interface LocationResolutionPolicy {
	allowProviderLookup: boolean;
	allowArrondissementFallback: boolean;
	forceRefresh?: boolean;
}

export interface StoredLocationResolution extends LocationResolution {
	id: string;
	name: string;
	arrondissement: ParisArrondissement;
	lastUpdated: string;
}

export const TRUSTED_LOCATION_SOURCES = ["manual", "geocoded"] as const;

export const isTrustedLocationResolution = (
	resolution: LocationResolution | null | undefined,
): boolean =>
	Boolean(
		resolution?.coordinates &&
			TRUSTED_LOCATION_SOURCES.includes(
				resolution.source as (typeof TRUSTED_LOCATION_SOURCES)[number],
			),
	);
