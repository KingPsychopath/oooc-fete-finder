import { describe, expect, it } from "vitest";
import { parseSupportedNationalities } from "@/features/events/nationality-utils";

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

	it("reports unsupported country tokens", () => {
		const parsed = parseSupportedNationalities("🇫🇷🇩🇪");

		expect(parsed.codes).toEqual(["FR"]);
		expect(parsed.unsupportedTokens).toContain("DE");
	});
});
