import {
	getCustomGenreColor,
	resolveMusicGenre,
} from "@/features/events/genre-normalization";
import { describe, expect, it } from "vitest";

describe("genre normalization", () => {
	it("keeps custom genre colors stable and avoids reserved colors", () => {
		const firstColor = getCustomGenreColor("French Pop");
		const nextColor = getCustomGenreColor("French Pop", [firstColor]);

		expect(getCustomGenreColor("French Pop")).toBe(firstColor);
		expect(nextColor).not.toBe(firstColor);
		expect(nextColor).toMatch(/^bg-[a-z]+-\d+$/);
	});

	it("ignores aliases for inactive custom genres", () => {
		expect(
			resolveMusicGenre("french pop", {
				genres: [
					{
						key: "french pop",
						label: "French Pop",
						color: "bg-pink-700",
						isActive: false,
					},
				],
				aliases: [{ alias: "french pop", genreKey: "french pop" }],
			}),
		).toBeNull();
	});
});
