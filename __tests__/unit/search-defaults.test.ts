import { DEFAULT_SEARCH_EXAMPLES } from "@/features/events/search-defaults";
import { describe, expect, it } from "vitest";

describe("DEFAULT_SEARCH_EXAMPLES", () => {
	it("uses the curated static chip order", () => {
		expect(DEFAULT_SEARCH_EXAMPLES).toEqual([
			"Night",
			"Free",
			"21st",
			"OOOC",
			"R&B",
			"Afrobeats",
			"Konpa",
			"Amapiano",
		]);
	});
});
