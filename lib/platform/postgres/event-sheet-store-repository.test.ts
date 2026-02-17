import { describe, expect, it } from "vitest";
import { normalizeEventSheetRowData } from "@/lib/platform/postgres/row-data-normalizer";

describe("normalizeEventSheetRowData", () => {
	it("normalizes plain object values to string records", () => {
		const result = normalizeEventSheetRowData({
			name: "Afters",
			date: "21 June",
			notes: null,
			rank: 3,
		});

		expect(result).toEqual({
			name: "Afters",
			date: "21 June",
			notes: "",
			rank: "3",
		});
	});

	it("normalizes one-layer JSON string payload", () => {
		const raw = JSON.stringify({ name: "Event", date: "22 June" });
		const result = normalizeEventSheetRowData(raw);
		expect(result).toEqual({ name: "Event", date: "22 June" });
	});

	it("normalizes double-encoded JSON string payload", () => {
		const raw = JSON.stringify(JSON.stringify({ name: "Event", date: "23 June" }));
		const result = normalizeEventSheetRowData(raw);
		expect(result).toEqual({ name: "Event", date: "23 June" });
	});

	it("returns empty record for invalid payload", () => {
		expect(normalizeEventSheetRowData("not-json")).toEqual({});
		expect(normalizeEventSheetRowData(null)).toEqual({});
	});
});
