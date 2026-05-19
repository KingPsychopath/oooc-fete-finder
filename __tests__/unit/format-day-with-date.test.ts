import {
	type Event,
	formatDayWithDate,
	formatEventDateRangeLabel,
	formatEventOccurrenceLabel,
} from "@/features/events/types";
import { describe, expect, it } from "vitest";

describe("formatDayWithDate", () => {
	it("formats valid ISO dates with ordinal suffix", () => {
		expect(formatDayWithDate("saturday", "2025-06-21")).toBe("Saturday 21st");
	});

	it("avoids NaN output when date is invalid", () => {
		expect(formatDayWithDate("friday", "")).toBe("Friday");
		expect(formatDayWithDate("friday", "not-a-date")).toBe("Friday");
	});

	it("returns TBC when day is unknown", () => {
		expect(formatDayWithDate("tbc", "2025-06-21")).toBe("TBC");
	});
});

describe("event range labels", () => {
	const baseEvent = {
		eventKey: "evt_test",
		slug: "test",
		id: "evt_test",
		name: "Test",
		day: "saturday",
		date: "2026-06-22",
		arrondissement: 11,
		link: "",
		description: "",
		type: "Fete",
		genre: [],
		tags: [],
		venueTypes: ["indoor"],
		indoor: true,
		price: "",
	} satisfies Event;

	it("formats compact date range and occurrence context", () => {
		const event = {
			...baseEvent,
			occurrenceIndex: 1,
			occurrenceCount: 3,
			dateRangeStart: "2026-06-21",
			dateRangeEnd: "2026-06-23",
		};

		expect(formatEventDateRangeLabel(event)).toBe("21-23 Jun");
		expect(formatEventOccurrenceLabel(event)).toBe("Day 2 of 3");
	});

	it("omits range labels for single events", () => {
		expect(formatEventDateRangeLabel(baseEvent)).toBeNull();
		expect(formatEventOccurrenceLabel(baseEvent)).toBeNull();
	});
});
