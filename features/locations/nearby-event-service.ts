import type { Event } from "@/features/events/types";
import { isTrustedLocationResolution } from "./types";
import type { LocationResolution } from "./types";

export interface NearbyEvent extends Event {
	distanceKm: number;
	locationPrecision: LocationResolution["precision"];
	locationSource: LocationResolution["source"];
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const calculateDistanceKm = (
	from: { lat: number; lng: number },
	to: { lat: number; lng: number },
): number => {
	const dLat = toRadians(to.lat - from.lat);
	const dLng = toRadians(to.lng - from.lng);
	const fromLat = toRadians(from.lat);
	const toLat = toRadians(to.lat);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getTrustedResolution = (
	event: Event,
): LocationResolution | null => {
	if (event.locationResolution && isTrustedLocationResolution(event.locationResolution)) {
		return event.locationResolution;
	}
	if (event.coordinates) {
		return {
			coordinates: event.coordinates,
			source: "geocoded",
			precision: "venue",
			confidence: 0.75,
		};
	}
	return null;
};

export const findNearbyEvents = (
	events: Event[],
	origin: { lat: number; lng: number },
	options: {
		limit?: number;
		maxDistanceKm?: number;
	} = {},
): NearbyEvent[] => {
	const { limit = 10, maxDistanceKm = Number.POSITIVE_INFINITY } = options;
	const nearby: NearbyEvent[] = [];

	for (const event of events) {
		const resolution = getTrustedResolution(event);
		if (!resolution?.coordinates) continue;
		const distanceKm = calculateDistanceKm(origin, resolution.coordinates);
		if (distanceKm > maxDistanceKm) continue;
		nearby.push({
			...event,
			distanceKm,
			locationPrecision: resolution.precision,
			locationSource: resolution.source,
		});
	}

	return nearby
		.sort((left, right) => left.distanceKm - right.distanceKm)
		.slice(0, limit);
};
