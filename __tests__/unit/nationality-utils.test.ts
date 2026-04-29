import { parseSupportedNationalities } from "@/features/events/nationality-utils";
import { describe, expect, it } from "vitest";

describe("parseSupportedNationalities", () => {
	it("parses concatenated flag emojis including NL", () => {
		const parsed = parseSupportedNationalities("🇫🇷🇳🇱");

		expect(parsed.codes).toEqual(["FR", "NL"]);
		expect(parsed.unsupportedTokens).toEqual([]);
	});

	it("parses mixed text and flag values", () => {
		const parsed = parseSupportedNationalities("GB/FR + Canada");

		expect(parsed.codes).toEqual(["UK", "FR", "CA"]);
	});

	it("parses countries beyond the visible default filter set", () => {
		const parsed = parseSupportedNationalities("United States / Spanish / 🇩🇪");

		expect(parsed.codes).toEqual(expect.arrayContaining(["US", "ES", "DE"]));
		expect(parsed.unsupportedTokens).toEqual([]);
	});

	it("reports invalid country tokens", () => {
		const parsed = parseSupportedNationalities("FR / XX");

		expect(parsed.codes).toEqual(["FR"]);
		expect(parsed.unsupportedTokens).toContain("XX");
	});
});
