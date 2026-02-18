import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventLocation } from "@/features/events/types";

const loadCoordinateService = async (options: {
	supportsGeocoding: boolean;
	geocodeAddress?: ReturnType<typeof vi.fn>;
}) => {
	vi.resetModules();

	const geocodeAddress =
		options.geocodeAddress ??
		vi.fn().mockResolvedValue({
			latitude: 48.857,
			longitude: 2.381,
			formatted_address: "Le Klub, 11e arrondissement, Paris, France",
			place_id: "place-123",
			accuracy: "ROOFTOP",
		});

	vi.doMock("@/lib/google/api", () => ({
		GoogleCloudAPI: {
			geocodeAddress,
			supportsGeocoding: () => options.supportsGeocoding,
		},
	}));

	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	}));

	const module = await import("@/features/maps/coordinate-service");
	return { ...module, geocodeAddress };
};

describe("CoordinateService estimated upgrade", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("upgrades cached estimated coordinates to geocoded when API is available", async () => {
		const { CoordinateService, generateLocationStorageKey } =
			await loadCoordinateService({ supportsGeocoding: true });
		const key = generateLocationStorageKey("Le Klub", 11);
		const storedLocations = new Map<string, EventLocation>([
			[
				key,
				{
					id: key,
					name: "Le Klub",
					arrondissement: 11,
					coordinates: { lat: 48.858, lng: 2.382 },
					confidence: 0.5,
					source: "estimated",
					lastUpdated: "2026-02-18T00:00:00.000Z",
				},
			],
		]);

		const result = await CoordinateService.getCoordinates(
			"Le Klub",
			11,
			storedLocations,
		);

		expect(result?.source).toBe("geocoded");
		expect(result?.wasInStorage).toBe(false);
		expect(storedLocations.get(key)?.source).toBe("geocoded");
	});

	it("keeps cached estimated coordinates when geocoding is unavailable", async () => {
		const geocodeAddress = vi.fn();
		const { CoordinateService, generateLocationStorageKey } =
			await loadCoordinateService({
				supportsGeocoding: false,
				geocodeAddress,
			});
		const key = generateLocationStorageKey("Le Klub", 11);
		const storedLocations = new Map<string, EventLocation>([
			[
				key,
				{
					id: key,
					name: "Le Klub",
					arrondissement: 11,
					coordinates: { lat: 48.858, lng: 2.382 },
					confidence: 0.5,
					source: "estimated",
					lastUpdated: "2026-02-18T00:00:00.000Z",
				},
			],
		]);

		const result = await CoordinateService.getCoordinates(
			"Le Klub",
			11,
			storedLocations,
		);

		expect(result?.source).toBe("estimated");
		expect(result?.wasInStorage).toBe(true);
		expect(geocodeAddress).not.toHaveBeenCalled();
	});
});
