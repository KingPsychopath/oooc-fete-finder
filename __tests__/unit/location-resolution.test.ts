import { describe, expect, it, vi } from "vitest";
import type { GeocodingProvider } from "@/features/locations/providers/geocoding-provider";
import { buildMapLink } from "@/features/locations/map-link-builder";
import { findNearbyEvents } from "@/features/locations/nearby-event-service";
import { LocationResolver } from "@/features/locations/location-resolver";
import { LocationRepository } from "@/features/locations/location-repository";
import { generateLocationStorageKey } from "@/features/locations/location-utils";
import { EventCoordinatePopulator } from "@/features/maps/event-coordinate-populator";
import type { StoredLocationResolution } from "@/features/locations/types";
import type { Event } from "@/features/events/types";

const makeProvider = (
	overrides: Partial<GeocodingProvider> = {},
): GeocodingProvider => ({
	name: "test",
	isConfigured: () => true,
	geocode: vi.fn().mockResolvedValue({
		coordinates: { lat: 48.857, lng: 2.381 },
		source: "geocoded",
		precision: "venue",
		confidence: 0.9,
		provider: "test",
	}),
	...overrides,
});

const makeEvent = (
	id: string,
	coordinates?: Event["coordinates"],
	locationResolution?: Event["locationResolution"],
): Event =>
	({
		eventKey: id,
		id,
		slug: id,
		name: id,
		day: "friday",
		date: "2026-06-19",
		arrondissement: 11,
		link: "https://example.com",
		type: "Pre-Fete",
		genre: ["afrobeats"],
		venueTypes: ["indoor"],
		indoor: true,
		verified: true,
		location: "Le Klub",
		coordinates,
		locationResolution,
	}) as Event;

describe("location resolution", () => {
	it("normalizes location storage keys across case, accents, punctuation, and spacing", () => {
		const variants = [
			"Le Klub",
			" le   klub ",
			"LE-KLUB",
			"Le, Klub",
			"Lé Klub",
		].map((location) => generateLocationStorageKey(location, 11));

		expect(new Set(variants).size).toBe(1);
		expect(variants[0]).toBe("le_klub_11");
	});

	it("uses arrondissement fallback only as approximate area precision", async () => {
		const resolver = new LocationResolver(
			makeProvider({ isConfigured: () => false }),
		);
		const result = await resolver.resolve(
			{ locationName: "Le Klub", arrondissement: 11 },
			new Map<string, StoredLocationResolution>(),
			{
				allowProviderLookup: true,
				allowArrondissementFallback: true,
			},
		);

		expect(result.source).toBe("estimated_arrondissement");
		expect(result.precision).toBe("area");
		expect(result.coordinates).toEqual(
			expect.objectContaining({
				lat: expect.any(Number),
				lng: expect.any(Number),
			}),
		);
	});

	it("does not call a provider when policy disallows provider lookup", async () => {
		const provider = makeProvider();
		const resolver = new LocationResolver(provider);
		const result = await resolver.resolve(
			{ locationName: "Le Klub", arrondissement: 11 },
			new Map<string, StoredLocationResolution>(),
			{
				allowProviderLookup: false,
				allowArrondissementFallback: false,
			},
		);

		expect(provider.geocode).not.toHaveBeenCalled();
		expect(result.source).toBe("unresolved");
		expect(result.coordinates).toBeNull();
	});

	it("uses trusted coordinates for map links but text search for approximate locations", () => {
		const trustedUrl = buildMapLink({
			locationInput: "Le Klub",
			arrondissement: 11,
			provider: "google",
			resolution: {
				coordinates: { lat: 48.857, lng: 2.381 },
				source: "geocoded",
				precision: "venue",
				confidence: 0.9,
			},
		});
		const approximateUrl = buildMapLink({
			locationInput: "Le Klub",
			arrondissement: 11,
			provider: "google",
			resolution: {
				coordinates: { lat: 48.858, lng: 2.38 },
				source: "estimated_arrondissement",
				precision: "area",
				confidence: 0.35,
			},
		});

		expect(decodeURIComponent(trustedUrl)).toContain("48.857,2.381");
		expect(decodeURIComponent(approximateUrl)).toContain(
			"Le Klub 11th arrondissement",
		);
	});

	it("nearby events only use trusted coordinate resolutions", () => {
		const results = findNearbyEvents(
			[
				makeEvent("trusted", undefined, {
					coordinates: { lat: 48.857, lng: 2.381 },
					source: "geocoded",
					precision: "venue",
					confidence: 0.9,
				}),
				makeEvent("approximate", undefined, {
					coordinates: { lat: 48.858, lng: 2.38 },
					source: "estimated_arrondissement",
					precision: "area",
					confidence: 0.35,
				}),
			],
			{ lat: 48.856, lng: 2.38 },
		);

		expect(results.map((event) => event.eventKey)).toEqual(["trusted"]);
	});

	it("hydrates stored coordinates without calling a geocoding provider", async () => {
		vi.spyOn(LocationRepository, "load").mockResolvedValue(
			new Map<string, StoredLocationResolution>([
				[
					"le_klub_11",
					{
						id: "le_klub_11",
						name: "Le Klub",
						arrondissement: 11,
						coordinates: { lat: 48.857, lng: 2.381 },
						source: "manual",
						precision: "exact",
						confidence: 1,
						lastUpdated: "2026-04-28T00:00:00.000Z",
						lastResolvedAt: "2026-04-28T00:00:00.000Z",
					},
				],
			]),
		);

		const [event] = await EventCoordinatePopulator.hydrateStoredCoordinates([
			makeEvent("stored"),
		]);

		expect(event.coordinates).toEqual({ lat: 48.857, lng: 2.381 });
		expect(event.locationResolution?.source).toBe("manual");
	});
});
