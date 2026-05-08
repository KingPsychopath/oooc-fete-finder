import { describe, expect, it } from "vitest";
import {
	CARD_SOCIAL_PROOF_MAX_VISIBLE,
	getSocialProofSaveWindowDays,
	getSocialProofDisplayModes,
} from "@/features/events/social-proof";

describe("getSocialProofDisplayModes", () => {
	it("shows numeric proof for the top three and generic proof for the remaining visible events", () => {
		const modes = getSocialProofDisplayModes([
			{ eventKey: "first", name: "First", socialProofSaveCount: 20 },
			{ eventKey: "second", name: "Second", socialProofSaveCount: 19 },
			{ eventKey: "third", name: "Third", socialProofSaveCount: 18 },
			{ eventKey: "fourth", name: "Fourth", socialProofSaveCount: 17 },
			{ eventKey: "fifth", name: "Fifth", socialProofSaveCount: 16 },
			{ eventKey: "sixth", name: "Sixth", socialProofSaveCount: 15 },
			{ eventKey: "seventh", name: "Seventh", socialProofSaveCount: 14 },
			{ eventKey: "eighth", name: "Eighth", socialProofSaveCount: 13 },
			{ eventKey: "ninth", name: "Ninth", socialProofSaveCount: 12 },
			{ eventKey: "tenth", name: "Tenth", socialProofSaveCount: 11 },
			{ eventKey: "below-threshold", name: "Below", socialProofSaveCount: 2 },
		]);

		expect(modes.size).toBe(CARD_SOCIAL_PROOF_MAX_VISIBLE);
		expect(modes.get("first")).toBe("numeric");
		expect(modes.get("second")).toBe("numeric");
		expect(modes.get("third")).toBe("numeric");
		expect(modes.get("fourth")).toBe("generic");
		expect(modes.get("ninth")).toBe("generic");
		expect(modes.has("tenth")).toBe(false);
		expect(modes.has("below-threshold")).toBe(false);
	});

	it("uses strong historical saves for generic proof only", () => {
		const modes = getSocialProofDisplayModes([
			{ eventKey: "first", name: "First", socialProofSaveCount: 20 },
			{ eventKey: "second", name: "Second", socialProofSaveCount: 19 },
			{ eventKey: "third", name: "Third", socialProofSaveCount: 18 },
			{
				eventKey: "historical",
				name: "Historical",
				socialProofSaveCount: 1,
				socialProofHistoricalSaveCount: 10,
			},
			{
				eventKey: "weak-historical",
				name: "Weak Historical",
				socialProofSaveCount: 1,
				socialProofHistoricalSaveCount: 9,
			},
		]);

		expect(modes.get("first")).toBe("numeric");
		expect(modes.get("second")).toBe("numeric");
		expect(modes.get("third")).toBe("numeric");
		expect(modes.get("historical")).toBe("generic");
		expect(modes.has("weak-historical")).toBe(false);
	});

	it("uses a longer save window early and tightens near Fete", () => {
		expect(
			getSocialProofSaveWindowDays(new Date("2026-05-08T12:00:00.000Z")),
		).toBe(21);
		expect(
			getSocialProofSaveWindowDays(new Date("2026-06-01T12:00:00.000Z")),
		).toBe(14);
		expect(
			getSocialProofSaveWindowDays(new Date("2026-06-13T12:00:00.000Z")),
		).toBe(14);
		expect(
			getSocialProofSaveWindowDays(new Date("2026-06-14T12:00:00.000Z")),
		).toBe(7);
		expect(
			getSocialProofSaveWindowDays(new Date("2026-06-21T12:00:00.000Z")),
		).toBe(7);
	});
});
