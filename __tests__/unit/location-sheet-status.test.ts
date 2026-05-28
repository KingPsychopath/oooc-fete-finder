import {
	findLikelyLocationAliases,
	getSheetLocationTrustState,
	normalizeLocationAliasText,
	toSheetLocationResolutionIndex,
} from "@/features/locations/location-sheet-status";
import type { StoredLocationResolution } from "@/features/locations/types";
import { describe, expect, it } from "vitest";

const storedLocation = (
	overrides: Partial<StoredLocationResolution>,
): StoredLocationResolution => ({
	id: "folies_pigalle_9",
	name: "Folies Pigalle",
	arrondissement: 9,
	coordinates: { lat: 48.882, lng: 2.337 },
	source: "geocoded",
	precision: "venue",
	confidence: 0.9,
	lastUpdated: "2026-05-27T20:00:00.000Z",
	lastResolvedAt: "2026-05-27T20:00:00.000Z",
	...overrides,
});

describe("location sheet status", () => {
	it("keeps the editor payload compact while preserving review fields", () => {
		const index = toSheetLocationResolutionIndex([
			storedLocation({
				formattedAddress: "11 Pl. Pigalle, 75009 Paris, France",
				provider: "google",
			}),
		]);

		expect(index.folies_pigalle_9).toMatchObject({
			id: "folies_pigalle_9",
			name: "Folies Pigalle",
			source: "geocoded",
			formattedAddress: "11 Pl. Pigalle, 75009 Paris, France",
			provider: "google",
		});
	});

	it("classifies only manual/geocoded coordinates as trusted sheet states", () => {
		expect(
			getSheetLocationTrustState(storedLocation({ source: "manual" })),
		).toBe("manual");
		expect(getSheetLocationTrustState(storedLocation({}))).toBe("geocoded");
		expect(
			getSheetLocationTrustState(
				storedLocation({ source: "estimated_arrondissement" }),
			),
		).toBe("approximate");
		expect(
			getSheetLocationTrustState(storedLocation({ coordinates: null })),
		).toBe("unresolved");
	});

	it("normalizes punctuation, accents, and low-signal venue words for alias review", () => {
		expect(normalizeLocationAliasText("Folie's Pigalle Club, Paris")).toBe(
			"folies pigalle",
		);
		expect(normalizeLocationAliasText("L'Empire Club")).toBe("empire");
	});

	it("surfaces likely typo aliases in the same area without auto-merging", () => {
		const matches = findLikelyLocationAliases(
			{ key: "folies_pigalle_9", name: "Folies Pigalle", arrondissement: 9 },
			[
				{
					key: "folie_pigalle_9",
					name: "Folie Pigalle",
					arrondissement: 9,
				},
				{
					key: "folies_pigalle_18",
					name: "Folies Pigalle",
					arrondissement: 18,
				},
			],
		);

		expect(matches).toEqual([
			expect.objectContaining({
				key: "folie_pigalle_9",
				reason: "similar-name",
			}),
		]);
	});

	it("does not warn when a structured location only matches its older area-only key", () => {
		const matches = findLikelyLocationAliases(
			{
				key: "panic_room_101_rue_amelot_75011_paris_FR",
				name: "Panic Room",
				arrondissement: 11,
				address: "101 Rue Amelot",
				postalCode: "75011",
				city: "Paris",
				countryCode: "FR",
			},
			[
				{
					key: "panic_room_11",
					name: "Panic Room",
					arrondissement: 11,
				},
			],
		);

		expect(matches).toEqual([]);
	});

	it("does warn when the same normalized venue has conflicting structured places", () => {
		const matches = findLikelyLocationAliases(
			{
				key: "panic_room_101_rue_amelot_75011_paris_FR",
				name: "Panic Room",
				arrondissement: 11,
				address: "101 Rue Amelot",
				postalCode: "75011",
				city: "Paris",
				countryCode: "FR",
			},
			[
				{
					key: "panic_room_10_rue_oberkampf_75011_paris_FR",
					name: "Panic Room",
					arrondissement: 11,
					address: "10 Rue Oberkampf",
					postalCode: "75011",
					city: "Paris",
					countryCode: "FR",
				},
			],
		);

		expect(matches).toEqual([
			expect.objectContaining({
				key: "panic_room_10_rue_oberkampf_75011_paris_FR",
				reason: "same-normalized-name",
			}),
		]);
	});
});
