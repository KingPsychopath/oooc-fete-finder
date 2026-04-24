import { describe, expect, it } from "vitest";
import { serializeEventFilterStateToSearchParams } from "@/features/events/filter-state-persistence";
import {
	DEFAULT_EVENT_FILTER_STATE,
	getActiveFiltersCount,
	getDefaultDateRangeForEvents,
	hasActiveFilters,
} from "@/features/events/filtering";
import type { Event } from "@/features/events/types";

const makeEvent = (date: string, index: number): Event => ({
	eventKey: `evt_test${index.toString().padStart(8, "0")}`,
	slug: `test-${index}`,
	id: `evt_test${index.toString().padStart(8, "0")}`,
	name: `Event ${index}`,
	day: "friday",
	date,
	arrondissement: 11,
	link: "https://example.com",
	type: "Day Party",
	genre: ["afrobeats"],
	venueTypes: ["indoor"],
	indoor: true,
	verified: true,
});

describe("event filter defaults", () => {
	it("defaults to the current Paris year when matching events exist", () => {
		const defaultDateRange = getDefaultDateRangeForEvents(
			[
				makeEvent("2025-08-18", 1),
				makeEvent("2026-06-21", 2),
				makeEvent("2026-07-12", 3),
			],
			new Date("2026-04-24T10:00:00.000Z"),
		);

		expect(defaultDateRange).toEqual({
			from: "2026-01-01",
			to: "2026-12-31",
		});
	});

	it("falls back to an unfiltered date range when no current-year events exist", () => {
		const defaultDateRange = getDefaultDateRangeForEvents(
			[makeEvent("2025-08-18", 1)],
			new Date("2026-04-24T10:00:00.000Z"),
		);

		expect(defaultDateRange).toEqual({
			from: null,
			to: null,
		});
	});

	it("does not count the default year range as an active filter or URL param", () => {
		const defaultDateRange = {
			from: "2026-01-01",
			to: "2026-12-31",
		};
		const state = {
			...DEFAULT_EVENT_FILTER_STATE,
			selectedDateRange: defaultDateRange,
		};

		expect(hasActiveFilters(state, { defaultDateRange })).toBe(false);
		expect(getActiveFiltersCount(state, { defaultDateRange })).toBe(0);

		const params = serializeEventFilterStateToSearchParams(
			new URLSearchParams("event=abc123"),
			state,
			{ defaultDateRange },
		);

		expect(params.toString()).toBe("event=abc123");
	});
});
