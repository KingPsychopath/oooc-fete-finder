import { DEFAULT_SEARCH_EXAMPLES } from "@/features/events/search-defaults";
import { describe, expect, it } from "vitest";

describe("DEFAULT_SEARCH_EXAMPLES", () => {
	it("includes all weekdays", () => {
		expect(DEFAULT_SEARCH_EXAMPLES).toEqual(
			expect.arrayContaining([
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
				"Sunday",
			]),
		);
	});
});
