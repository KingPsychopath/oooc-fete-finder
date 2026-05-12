import {
	DEFAULT_EVENT_FILTER_STATE,
	filterEvents,
} from "@/features/events/filtering";
import {
	type Event,
	formatTimeWithPeriod,
	getEventDisplayDayNightPeriod,
	getEventTemporalProfile,
	getEventTypeForDate,
	isEventInDayNightPeriod,
} from "@/features/events/types";
import { describe, expect, it } from "vitest";

const makeEvent = (suffix: string, time?: string, endTime?: string): Event => ({
	eventKey: `evt_temporal_${suffix}`,
	slug: `temporal-${suffix}`,
	id: `evt_temporal_${suffix}`,
	name: `Temporal ${suffix}`,
	day: "saturday",
	date: "2026-06-21",
	time,
	endTime,
	arrondissement: 11,
	link: "https://example.com",
	type: getEventTypeForDate("2026-06-21"),
	genre: ["amapiano"],
	venueTypes: ["indoor"],
	indoor: true,
	sourceConfirmed: true,
});

describe("event temporal profile", () => {
	it("treats 21:00 starts as night", () => {
		const event = makeEvent("late-start", "21:00", "02:00");
		const profile = getEventTemporalProfile(event);

		expect(profile.primaryPeriod).toBe("overnight");
		expect(profile.matchesLegacyDay).toBe(false);
		expect(profile.matchesLegacyNight).toBe(true);
		expect(isEventInDayNightPeriod(event, "night")).toBe(true);
	});

	it("keeps short post-21:00 day parties in the day filter only", () => {
		const event = makeEvent("day-party", "14:00", "22:00");
		const profile = getEventTemporalProfile(event);

		expect(profile.primaryPeriod).toBe("day");
		expect(profile.matchesLegacyDay).toBe(true);
		expect(profile.matchesLegacyNight).toBe(false);
	});

	it("lets long day-into-night events match both filters", () => {
		const event = makeEvent("long-party", "16:00", "02:00");
		const profile = getEventTemporalProfile(event);

		expect(profile.primaryPeriod).toBe("overnight");
		expect(profile.crossesMidnight).toBe(true);
		expect(profile.matchesLegacyDay).toBe(true);
		expect(profile.matchesLegacyNight).toBe(true);
	});

	it("prefers the active filter period when displaying both-matching events", () => {
		const event = makeEvent("both-display", "14:00", "00:00");

		expect(getEventDisplayDayNightPeriod(event)).toBe("night");
		expect(getEventDisplayDayNightPeriod(event, ["day"])).toBe("day");
		expect(getEventDisplayDayNightPeriod(event, ["night"])).toBe("night");
		expect(getEventDisplayDayNightPeriod(event, ["day", "night"])).toBe(
			"night",
		);
	});

	it("treats evening events that run past 21:00 as night", () => {
		const event = makeEvent("evening-to-night", "18:30", "22:30");
		const profile = getEventTemporalProfile(event);

		expect(profile.primaryPeriod).toBe("night");
		expect(profile.matchesLegacyDay).toBe(false);
		expect(profile.matchesLegacyNight).toBe(true);
	});

	it("does not force unknown or invalid times into either filter", () => {
		for (const event of [
			makeEvent("tbc", "TBC", "02:00"),
			makeEvent("missing"),
			makeEvent("invalid", "24:00", "02:00"),
		]) {
			const profile = getEventTemporalProfile(event);
			expect(profile.primaryPeriod).toBe("unknown");
			expect(profile.matchesLegacyDay).toBe(false);
			expect(profile.matchesLegacyNight).toBe(false);
		}
		expect(formatTimeWithPeriod("24:00")).toBe("24:00");
	});

	it("filters using the expanded day/night semantics", () => {
		const dayOnly = makeEvent("day-only", "14:00", "22:00");
		const nightOnly = makeEvent("night-only", "21:00", "02:00");
		const both = makeEvent("both", "16:00", "02:00");
		const events = [dayOnly, nightOnly, both];

		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				selectedDayNightPeriods: ["day"],
			}).map((event) => event.id),
		).toEqual([dayOnly.id, both.id]);

		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				selectedDayNightPeriods: ["night"],
			}).map((event) => event.id),
		).toEqual([nightOnly.id, both.id]);
	});
});
