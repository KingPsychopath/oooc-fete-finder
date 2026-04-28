import { describe, expect, it } from "vitest";
import {
	CARD_SOCIAL_PROOF_MAX_VISIBLE,
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
});
