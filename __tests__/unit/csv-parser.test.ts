import { describe, expect, it } from "vitest";
import { parseCSVContent } from "@/features/data-management/csv/parser";

describe("parseCSVContent", () => {
	it("parses canonical headers and ignores fully empty rows", () => {
		const csv = [
			"Name,Date,Location,Genre",
			",,,",
			"Sunset Party,21 June,Paris,Afro",
		].join("\n");

		const rows = parseCSVContent(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe("Sunset Party");
		expect(rows[0].date).toBe("21 June");
		expect(rows[0].location).toBe("Paris");
		expect(rows[0].genre).toBe("Afro");
	});

	it("supports alias headers for essential fields", () => {
		const csv = [
			"Event Name,Event Date,Venue",
			"Block Party,22 June,Canal",
		].join("\n");

		const rows = parseCSVContent(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe("Block Party");
		expect(rows[0].date).toBe("22 June");
		expect(rows[0].location).toBe("Canal");
	});

	it("throws a clear error when essential headers are missing", () => {
		const csv = ["Location,Genre", "Paris,Afro"].join("\n");

		expect(() => parseCSVContent(csv)).toThrow(
			"Missing essential CSV columns: name, date",
		);
	});

	it("throws a clear error when header row is empty", () => {
		expect(() => parseCSVContent("\n\n")).toThrow(
			"CSV header row is missing or empty",
		);
	});

	it("throws when multiple headers map to the same field", () => {
		const csv = [
			"Name,Event Name,Date",
			"Main name,Alt name,2026-06-21",
		].join("\n");

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

		expect(() => parseCSVContent(csv)).toThrow(
			"CSV row structure mismatch",
		);
	});
});
