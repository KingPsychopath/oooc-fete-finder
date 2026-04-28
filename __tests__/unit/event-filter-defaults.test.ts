import { describe, expect, it } from "vitest";
import {
	resolveInitialEventFilterStateFromSearchParams,
	serializeEventFilterStateToSearchParams,
} from "@/features/events/filter-state-persistence";
import {
	DEFAULT_EVENT_FILTER_STATE,
	getActiveFiltersCount,
	getCurrentParisYearDateRange,
	getDefaultDateRangeForEvents,
	getEventCountForDateRange,
	getTopEventDatesByCount,
	hasActiveFilters,
} from "@/features/events/filtering";
import { getEventTypeForDate, type Event } from "@/features/events/types";

const makeEvent = (date: string, index: number): Event => ({
	eventKey: `evt_test${index.toString().padStart(8, "0")}`,
	slug: `test-${index}`,
	id: `evt_test${index.toString().padStart(8, "0")}`,
	name: `Event ${index}`,
	day: "friday",
	date,
	arrondissement: 11,
	link: "https://example.com",
	type: getEventTypeForDate(date),
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

	it("counts events inside the current Paris year range", () => {
		const currentYearDateRange = getCurrentParisYearDateRange(
			new Date("2026-04-24T10:00:00.000Z"),
		);

		expect(
			getEventCountForDateRange(
				[
					makeEvent("2025-08-18", 1),
					makeEvent("2026-06-21", 2),
					makeEvent("2026-12-31", 3),
					makeEvent("2027-01-01", 4),
				],
				currentYearDateRange,
			),
		).toBe(2);
	});

	it("limits quick-select dates to the default current-year range", () => {
		const events = [
			makeEvent("2025-06-20", 1),
			makeEvent("2025-06-20", 2),
			makeEvent("2025-06-20", 3),
			makeEvent("2026-06-21", 4),
			makeEvent("2026-06-22", 5),
		];
		const defaultDateRange = getDefaultDateRangeForEvents(
			events,
			new Date("2026-04-24T10:00:00.000Z"),
		);

		expect(
			getTopEventDatesByCount(events, 4, defaultDateRange),
		).toEqual(["2026-06-21", "2026-06-22"]);
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

	it("keeps the default year range for search-only URL filters", () => {
		const defaultDateRange = {
			from: "2026-01-01",
			to: "2026-12-31",
		};

		const state = resolveInitialEventFilterStateFromSearchParams(
			new URLSearchParams("q=Pre-Fete"),
			{ defaultDateRange },
		);

		expect(state).toMatchObject({
			searchQuery: "Pre-Fete",
			selectedDateRange: defaultDateRange,
		});
	});

	it("keeps explicit valid URL date filters over the default year range", () => {
		const defaultDateRange = {
			from: "2026-01-01",
			to: "2026-12-31",
		};

		const state = resolveInitialEventFilterStateFromSearchParams(
			new URLSearchParams("q=Pre-Fete&df=2025-01-01&dt=2025-12-31"),
			{ defaultDateRange },
		);

		expect(state).toMatchObject({
			searchQuery: "Pre-Fete",
			selectedDateRange: {
				from: "2025-01-01",
				to: "2025-12-31",
			},
		});
	});

	it("falls back to the default year range for invalid URL date filters", () => {
		const defaultDateRange = {
			from: "2026-01-01",
			to: "2026-12-31",
		};

		const state = resolveInitialEventFilterStateFromSearchParams(
			new URLSearchParams("q=Pre-Fete&df=not-a-date"),
			{ defaultDateRange },
		);

		expect(state).toMatchObject({
			searchQuery: "Pre-Fete",
			selectedDateRange: defaultDateRange,
		});
	});

	it("does not count whitespace-only search as an active filter", () => {
		const state = {
			...DEFAULT_EVENT_FILTER_STATE,
			searchQuery: "   ",
		};

		expect(hasActiveFilters(state)).toBe(false);
		expect(getActiveFiltersCount(state)).toBe(0);
	});
});
