import { describe, expect, it } from "vitest";
import {
	buildEventSlug,
	ensureUniqueEventKeys,
	generateEventKeyFromRow,
	normalizeEventKey,
} from "@/features/data-management/assembly/event-key";

describe("event-key utilities", () => {
	it("normalizes and validates explicit event keys", () => {
		expect(normalizeEventKey(" EVT_ABCDEF123456 ")).toBe("evt_abcdef123456");
		expect(normalizeEventKey("not-valid")).toBeNull();
	});

	it("generates deterministic keys from row data", () => {
		const row = {
			name: "Sunset Party",
			date: "2025-06-21",
			startTime: "18:00",
			location: "Paris",
			eventKey: "",
		};

		const first = generateEventKeyFromRow(row);
		const second = generateEventKeyFromRow(row);
		expect(first).toBe(second);
		expect(first.startsWith("evt_")).toBe(true);
	});

	it("ensures uniqueness and preserves valid existing keys", () => {
		const rows = [
			{
				eventKey: "evt_aaaaaaaaaaaa",
				name: "A",
				date: "2025-06-20",
			},
			{
				eventKey: "",
				name: "A",
				date: "2025-06-20",
			},
			{
				eventKey: "evt_aaaaaaaaaaaa",
				name: "A",
				date: "2025-06-20",
			},
		];

		const result = ensureUniqueEventKeys(rows);
		expect(result.rows[0].eventKey).toBe("evt_aaaaaaaaaaaa");
		expect(result.rows[1].eventKey).not.toBe("");
		expect(result.rows[2].eventKey).not.toBe("evt_aaaaaaaaaaaa");
		expect(new Set(result.rows.map((row) => row.eventKey)).size).toBe(
			result.rows.length,
		);
		expect(result.missingEventKeyCount).toBe(1);
		expect(result.generatedEventKeyCount).toBe(2);
	});

	it("builds readable slugs from event names", () => {
		expect(buildEventSlug("IMERSIV Summer Party - Day 1")).toBe(
			"imersiv-summer-party-day-1",
		);
		expect(buildEventSlug("   ")).toBe("event");
	});
});

