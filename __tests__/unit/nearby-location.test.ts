import {
	DEFAULT_NEARBY_RADIUS_KM,
	getNearbyLocationScope,
	normalizeNearbyRadiusKm,
	shouldApplyNearbyRadius,
} from "@/features/locations/nearby-location";
import { describe, expect, it } from "vitest";

describe("nearby location scope", () => {
	it("treats Paris-area coordinates as drawable on the Paris map", () => {
		const paris = { lat: 48.8566, lng: 2.3522 };

		expect(getNearbyLocationScope(paris)).toBe("paris-map");
		expect(shouldApplyNearbyRadius(paris)).toBe(true);
	});

	it("does not apply the Paris map radius to far-away users", () => {
		const london = { lat: 51.5072, lng: -0.1276 };

		expect(getNearbyLocationScope(london)).toBe("outside-paris-map");
		expect(shouldApplyNearbyRadius(london)).toBe(false);
	});

	it("normalizes unsupported radius values to the default", () => {
		expect(normalizeNearbyRadiusKm(5)).toBe(5);
		expect(normalizeNearbyRadiusKm(7)).toBe(DEFAULT_NEARBY_RADIUS_KM);
	});
});
