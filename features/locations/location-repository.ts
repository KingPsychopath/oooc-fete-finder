import type { EventLocation } from "@/features/events/types";
import { LocationStorage } from "@/features/maps/location-storage";
import { generateLocationStorageKey } from "./location-utils";
import type { LocationResolution, StoredLocationResolution } from "./types";

const toStoredLocationResolution = (
	location: EventLocation,
): StoredLocationResolution => ({
	id: location.id,
	name: location.name,
	arrondissement: location.arrondissement,
	coordinates: location.coordinates,
	source:
		location.source === "estimated"
			? "estimated_arrondissement"
			: location.source,
	precision:
		location.precision ?? (location.source === "estimated" ? "area" : "venue"),
	confidence: location.confidence ?? (location.source === "manual" ? 1 : 0.5),
	formattedAddress: location.formattedAddress,
	provider: location.provider,
	providerPlaceId: location.providerPlaceId,
	query: location.query,
	lastUpdated: location.lastUpdated,
	lastResolvedAt: location.lastUpdated,
});

const toEventLocation = (
	resolution: StoredLocationResolution,
): EventLocation | null => {
	if (!resolution.coordinates || resolution.source === "unresolved") {
		return null;
	}
	return {
		id: resolution.id,
		name: resolution.name,
		arrondissement: resolution.arrondissement,
		coordinates: resolution.coordinates,
		confidence: resolution.confidence,
		source:
			resolution.source === "estimated_arrondissement"
				? "estimated"
				: resolution.source,
		precision: resolution.precision,
		formattedAddress: resolution.formattedAddress,
		provider: resolution.provider,
		providerPlaceId: resolution.providerPlaceId,
		query: resolution.query,
		lastUpdated: resolution.lastUpdated,
	};
};

export class LocationRepository {
	static async load(): Promise<Map<string, StoredLocationResolution>> {
		const stored = await LocationStorage.load();
		const resolutions = new Map<string, StoredLocationResolution>();
		for (const location of stored.values()) {
			const storedResolution = toStoredLocationResolution(location);
			const normalizedKey = generateLocationStorageKey(
				storedResolution.name,
				storedResolution.arrondissement,
			);
			resolutions.set(normalizedKey, {
				...storedResolution,
				id: normalizedKey,
			});
		}
		return resolutions;
	}

	static async save(
		resolutions: Map<string, StoredLocationResolution>,
	): Promise<void> {
		const locations = new Map<string, EventLocation>();
		for (const [key, resolution] of resolutions.entries()) {
			const eventLocation = toEventLocation(resolution);
			if (eventLocation) {
				locations.set(key, eventLocation);
			}
		}
		await LocationStorage.save(locations);
	}

	static toStoredResolution(
		id: string,
		name: string,
		arrondissement: StoredLocationResolution["arrondissement"],
		resolution: LocationResolution,
	): StoredLocationResolution {
		const now = new Date().toISOString();
		return {
			...resolution,
			id,
			name,
			arrondissement,
			lastUpdated: now,
			lastResolvedAt: resolution.lastResolvedAt ?? now,
		};
	}
}
