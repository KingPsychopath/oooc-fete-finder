import type { Coordinates } from "@/features/events/types";

export const NEARBY_RADIUS_OPTIONS_KM = [1, 3, 5, 10] as const;
export const DEFAULT_NEARBY_RADIUS_KM = 3;

export type NearbyRadiusKm = (typeof NEARBY_RADIUS_OPTIONS_KM)[number];

export const PARIS_MAP_BOUNDS = {
	southWest: { lat: 48.58, lng: 1.95 },
	northEast: { lat: 49.03, lng: 2.75 },
} as const;

export type NearbyLocationScope = "paris-map" | "outside-paris-map";

export const normalizeNearbyRadiusKm = (value: number): NearbyRadiusKm =>
	NEARBY_RADIUS_OPTIONS_KM.includes(value as NearbyRadiusKm)
		? (value as NearbyRadiusKm)
		: DEFAULT_NEARBY_RADIUS_KM;

export const isCoordinateInsideBounds = (
	coordinates: Coordinates,
	bounds = PARIS_MAP_BOUNDS,
): boolean =>
	coordinates.lat >= bounds.southWest.lat &&
	coordinates.lat <= bounds.northEast.lat &&
	coordinates.lng >= bounds.southWest.lng &&
	coordinates.lng <= bounds.northEast.lng;

export const getNearbyLocationScope = (
	coordinates: Coordinates,
): NearbyLocationScope =>
	isCoordinateInsideBounds(coordinates) ? "paris-map" : "outside-paris-map";

export const shouldApplyNearbyRadius = (
	coordinates: Coordinates | null | undefined,
): boolean =>
	Boolean(coordinates && getNearbyLocationScope(coordinates) === "paris-map");
