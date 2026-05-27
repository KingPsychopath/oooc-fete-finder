import type { Event } from "@/features/events/types";
import { LocationRepository } from "@/features/locations/location-repository";
import { LocationResolver } from "@/features/locations/location-resolver";
import {
	buildStructuredLocationSearchQuery,
	generateLocationStorageKey,
} from "@/features/locations/location-utils";
import { buildMapLink } from "@/features/locations/map-link-builder";
import { findNearbyEvents } from "@/features/locations/nearby-event-service";
import type { GeocodingProvider } from "@/features/locations/providers/geocoding-provider";
import type { StoredLocationResolution } from "@/features/locations/types";
import { EventCoordinatePopulator } from "@/features/maps/event-coordinate-populator";
import { LocationStorage } from "@/features/maps/location-storage";
import { describe, expect, it, vi } from "vitest";

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
		sourceConfirmed: true,
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

	it("uses structured place metadata in location storage keys when available", () => {
		expect(
			generateLocationStorageKey("La Marbrerie", "greater-paris", {
				address: "21 Rue Alexis Lepère",
				postalCode: "93100",
				city: "Montreuil",
			}),
		).toBe("la_marbrerie_21_rue_alexis_lepere_93100_montreuil_FR");
		expect(generateLocationStorageKey("La Marbrerie", 11)).toBe(
			"la_marbrerie_11",
		);
	});

	it("builds outside-Paris geocoding queries from structured fields", () => {
		const query = buildStructuredLocationSearchQuery({
			locationName: "La Marbrerie",
			arrondissement: "greater-paris",
			postalCode: "93100",
			city: "Montreuil",
		});

		expect(query).toBe("La Marbrerie, 93100 Montreuil, France");
		expect(query).not.toContain("Paris, France");
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

	it("passes structured place context through the resolver and cache key", async () => {
		const provider = makeProvider();
		const resolver = new LocationResolver(provider);
		const storedLocations = new Map<string, StoredLocationResolution>();
		const result = await resolver.resolve(
			{
				locationName: "La Marbrerie",
				arrondissement: "greater-paris",
				postalCode: "93100",
				city: "Montreuil",
			},
			storedLocations,
			{
				allowProviderLookup: true,
				allowArrondissementFallback: false,
			},
		);

		expect(result.source).toBe("geocoded");
		expect(provider.geocode).toHaveBeenCalledWith(
			expect.objectContaining({
				locationName: "La Marbrerie",
				arrondissement: "greater-paris",
				postalCode: "93100",
				city: "Montreuil",
			}),
		);
		expect(storedLocations.has("la_marbrerie_93100_montreuil_FR")).toBe(true);
	});

	it("can surface provider failures for explicit admin refreshes", async () => {
		const provider = makeProvider({
			geocode: vi.fn().mockRejectedValue(new Error("OVER_QUERY_LIMIT")),
		});
		const resolver = new LocationResolver(provider);

		await expect(
			resolver.resolve(
				{ locationName: "Le Klub", arrondissement: 11 },
				new Map<string, StoredLocationResolution>(),
				{
					allowProviderLookup: true,
					allowArrondissementFallback: false,
					throwOnProviderError: true,
				},
			),
		).rejects.toThrow("OVER_QUERY_LIMIT");
	});

	it("does not provider-geocode broad outside Paris locations without locality context", async () => {
		const provider = makeProvider();
		const resolver = new LocationResolver(provider);

		const broadResult = await resolver.resolve(
			{
				locationName: "Domaine de la Grange-la-Prévôté",
				arrondissement: "outside-paris",
			},
			new Map<string, StoredLocationResolution>(),
			{
				allowProviderLookup: true,
				allowArrondissementFallback: false,
			},
		);

		expect(provider.geocode).not.toHaveBeenCalled();
		expect(broadResult.source).toBe("unresolved");

		await resolver.resolve(
			{
				locationName: "Domaine de la Grange-la-Prévôté",
				arrondissement: "outside-paris",
				postalCode: "77176",
				city: "Savigny-le-Temple",
			},
			new Map<string, StoredLocationResolution>(),
			{
				allowProviderLookup: true,
				allowArrondissementFallback: false,
			},
		);

		expect(provider.geocode).toHaveBeenCalledOnce();
	});

	it("uses human place search for map links when location text is available", () => {
		const trustedUrl = buildMapLink({
			locationInput: "Le Klub",
			arrondissement: 11,
			provider: "google",
			resolution: {
				coordinates: { lat: 48.857, lng: 2.381 },
				source: "geocoded",
				precision: "venue",
				confidence: 0.9,
				providerPlaceId: "google-place-123",
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

		expect(decodeURIComponent(trustedUrl)).toContain(
			"Le Klub 11th arrondissement",
		);
		expect(trustedUrl).toContain("query_place_id=google-place-123");
		expect(decodeURIComponent(trustedUrl)).not.toContain("48.857,2.381");
		expect(decodeURIComponent(approximateUrl)).toContain(
			"Le Klub 11th arrondissement",
		);
	});

	it("falls back to trusted coordinates for map links when no search text exists", () => {
		const trustedUrl = buildMapLink({
			locationInput: "",
			provider: "google",
			resolution: {
				coordinates: { lat: 48.857, lng: 2.381 },
				source: "geocoded",
				precision: "venue",
				confidence: 0.9,
			},
		});

		expect(decodeURIComponent(trustedUrl)).toContain("48.857,2.381");
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

	it("nearby events can be limited to a selected radius", () => {
		const results = findNearbyEvents(
			[
				makeEvent("inside", undefined, {
					coordinates: { lat: 48.857, lng: 2.381 },
					source: "geocoded",
					precision: "venue",
					confidence: 0.9,
				}),
				makeEvent("outside", undefined, {
					coordinates: { lat: 48.886, lng: 2.45 },
					source: "geocoded",
					precision: "venue",
					confidence: 0.9,
				}),
			],
			{ lat: 48.856, lng: 2.38 },
			{ maxDistanceKm: 3 },
		);

		expect(results.map((event) => event.eventKey)).toEqual(["inside"]);
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

	it("hydrates structured stored locations when event rows only carry venue and area", async () => {
		const structuredKey = generateLocationStorageKey(
			"Domaine de la Grange-la-Prévôté",
			"outside-paris",
			{
				address: "Avenue du 8 Mai 1945",
				postalCode: "77176",
				city: "Savigny-le-Temple",
				countryCode: "FR",
			},
		);
		vi.spyOn(LocationRepository, "load").mockResolvedValue(
			new Map<string, StoredLocationResolution>([
				[
					generateLocationStorageKey(
						"Domaine de la Grange-la-Prévôté",
						"outside-paris",
					),
					{
						id: structuredKey,
						name: "Domaine de la Grange-la-Prévôté",
						arrondissement: "outside-paris",
						address: "Avenue du 8 Mai 1945",
						postalCode: "77176",
						city: "Savigny-le-Temple",
						countryCode: "FR",
						coordinates: { lat: 48.6003155, lng: 2.5560718 },
						source: "geocoded",
						precision: "venue",
						confidence: 0.7,
						lastUpdated: "2026-05-27T00:00:00.000Z",
						lastResolvedAt: "2026-05-27T00:00:00.000Z",
					},
				],
			]),
		);

		const [event] = await EventCoordinatePopulator.hydrateStoredCoordinates([
			{
				...makeEvent("nickipik"),
				location: "Domaine de la Grange-la-Prévôté",
				arrondissement: "outside-paris",
			},
		]);

		expect(event.coordinates).toEqual({ lat: 48.6003155, lng: 2.5560718 });
		expect(event.locationResolution?.source).toBe("geocoded");
	});

	it("persists structured locations under one canonical key instead of area aliases", async () => {
		const structuredKey = generateLocationStorageKey("Panic Room", 11, {
			address: "101 Rue Amelot",
			postalCode: "75011",
			city: "Paris",
			countryCode: "FR",
		});
		const saveSpy = vi
			.spyOn(LocationStorage, "save")
			.mockResolvedValue(undefined);

		await LocationRepository.save(
			new Map<string, StoredLocationResolution>([
				[
					"panic_room_11",
					{
						id: "panic_room_11",
						name: "Panic Room",
						arrondissement: 11,
						address: "101 Rue Amelot",
						postalCode: "75011",
						city: "Paris",
						countryCode: "FR",
						coordinates: { lat: 48.862, lng: 2.367 },
						source: "geocoded",
						precision: "venue",
						confidence: 0.9,
						lastUpdated: "2026-05-27T00:00:00.000Z",
						lastResolvedAt: "2026-05-27T00:00:00.000Z",
					},
				],
				[
					structuredKey,
					{
						id: structuredKey,
						name: "Panic Room",
						arrondissement: 11,
						address: "101 Rue Amelot",
						postalCode: "75011",
						city: "Paris",
						countryCode: "FR",
						coordinates: { lat: 48.862, lng: 2.367 },
						source: "geocoded",
						precision: "venue",
						confidence: 0.9,
						lastUpdated: "2026-05-27T00:00:00.000Z",
						lastResolvedAt: "2026-05-27T00:00:00.000Z",
					},
				],
			]),
		);

		const savedLocations = saveSpy.mock.calls[0]?.[0];
		expect(savedLocations?.has("panic_room_11")).toBe(false);
		expect(savedLocations?.has(structuredKey)).toBe(true);
		expect(savedLocations?.size).toBe(1);
		saveSpy.mockRestore();
	});
});
