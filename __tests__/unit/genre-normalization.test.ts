import {
	DEFAULT_GENRE_TAXONOMY,
	getCustomGenreColor,
	isRedundantGenreAlias,
	resolveMusicGenre,
	toGenreLabel,
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

	it("resolves active custom genres by key and label", () => {
		const taxonomy = {
			genres: [
				{
					key: "french pop",
					label: "French Pop",
					color: "bg-pink-700",
					isActive: true,
				},
			],
			aliases: [],
		};

		expect(resolveMusicGenre("french pop", taxonomy)).toBe("french pop");
		expect(resolveMusicGenre("French Pop", taxonomy)).toBe("french pop");
	});

	it("keeps redundant normalization aliases out of the default taxonomy", () => {
		expect(
			DEFAULT_GENRE_TAXONOMY.aliases.some((alias) =>
				isRedundantGenreAlias(alias.alias, alias.genreKey),
			),
		).toBe(false);
		expect(resolveMusicGenre("afro-house")).toBe("afro house");
		expect(resolveMusicGenre("afro trap")).toBe("afrotrap");
		expect(resolveMusicGenre("3step")).toBe("3-step");
		expect(resolveMusicGenre("coupe-decale")).toBe("coupé-décalé");
		expect(resolveMusicGenre("francais")).toBe("francophone");
	});

	it("uses familiar display casing for common alias labels", () => {
		expect(toGenreLabel("edm")).toBe("EDM");
		expect(toGenreLabel("francais")).toBe("Français");
	});

	it("maps techno into electro rather than house", () => {
		expect(resolveMusicGenre("techno")).toBe("electro");
	});

	it("does not keep unwanted cleanup aliases in the default taxonomy", () => {
		expect(resolveMusicGenre("soul")).toBeNull();
		expect(resolveMusicGenre("afo house")).toBeNull();
		expect(
			DEFAULT_GENRE_TAXONOMY.aliases.some(
				(alias) =>
					alias.alias === "afro trap" ||
					alias.alias === "soul" ||
					alias.alias === "afo house",
			),
		).toBe(false);
	});
});
