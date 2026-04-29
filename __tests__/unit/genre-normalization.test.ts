import { getCustomGenreColor } from "@/features/events/genre-normalization";
import { describe, expect, it } from "vitest";

describe("genre normalization", () => {
	it("keeps custom genre colors stable and avoids reserved colors", () => {
		const firstColor = getCustomGenreColor("French Pop");
		const nextColor = getCustomGenreColor("French Pop", [firstColor]);

		expect(getCustomGenreColor("French Pop")).toBe(firstColor);
		expect(nextColor).not.toBe(firstColor);
		expect(nextColor).toMatch(/^bg-[a-z]+-\d+$/);
	});
});
