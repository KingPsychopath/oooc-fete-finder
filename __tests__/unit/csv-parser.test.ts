import { parseCSVContent } from "@/features/data-management/csv/parser";
import { describe, expect, it } from "vitest";

describe("parseCSVContent", () => {
	it("parses canonical headers and ignores fully empty rows", () => {
		const csv = [
			"Title,Date,Location,Categories",
			",,,",
			"Sunset Party,21 June,Paris,Afro",
		].join("\n");

		const rows = parseCSVContent(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Sunset Party");
		expect(rows[0].date).toBe("21 June");
		expect(rows[0].location).toBe("Paris");
		expect(rows[0].categories).toBe("Afro");
	});

	it("supports legacy alias headers for essential fields", () => {
		const csv = [
			"Event Name,Event Date,Venue",
			"Block Party,22 June,Canal",
		].join("\n");

		const rows = parseCSVContent(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Block Party");
		expect(rows[0].date).toBe("22 June");
		expect(rows[0].location).toBe("Canal");
	});

	it("maps new country/category/url aliases into internal fields", () => {
		const csv = [
			"Title,Host Country,Audience Country,Categories,Tags,Primary URL,Age Guidance,Setting,Date",
			"Block Party,FR,CA,Afrobeats,\"roof,free\",https://example.com,18+,Outdoor,22 June",
		].join("\n");

		const rows = parseCSVContent(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Block Party");
		expect(rows[0].hostCountry).toBe("FR");
		expect(rows[0].audienceCountry).toBe("CA");
		expect(rows[0].categories).toBe("Afrobeats");
		expect(rows[0].tags).toBe("roof,free");
		expect(rows[0].primaryUrl).toBe("https://example.com");
		expect(rows[0].ageGuidance).toBe("18+");
		expect(rows[0].setting).toBe("Outdoor");
	});

	it("parses optional verified column when present", () => {
		const csv = [
			"Name,Date,Location,Verified",
			"Block Party,22 June,Canal,yes",
		].join("\n");

		const rows = parseCSVContent(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].verified).toBe("yes");
	});

	it("throws a clear error when essential headers are missing", () => {
		const csv = ["Location,Genre", "Paris,Afro"].join("\n");

		expect(() => parseCSVContent(csv)).toThrow(
			"Missing essential CSV columns: title, date",
		);
	});

	it("throws a clear error when header row is empty", () => {
		expect(() => parseCSVContent("\n\n")).toThrow(
			"CSV header row is missing or empty",
		);
	});

	it("throws when multiple headers map to the same field", () => {
		const csv = ["Name,Event Name,Date", "Main name,Alt name,2026-06-21"].join(
			"\n",
		);

		expect(() => parseCSVContent(csv)).toThrow(
			"Duplicate CSV column mappings detected",
		);
	});

	it("throws on row structure mismatches", () => {
		const csv = [
			"Name,Date,Location",
			"Valid row,2026-06-21,Paris",
			"Broken row,2026-06-22",
		].join("\n");

		expect(() => parseCSVContent(csv)).toThrow("CSV row structure mismatch");
	});
});
