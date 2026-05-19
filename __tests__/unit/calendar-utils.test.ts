import {
	generateICSContent,
	isCalendarDateValid,
} from "@/features/events/calendar-utils";
import { type Event, getEventTypeForDate } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const makeEvent = (date: string): Event => ({
	eventKey: "evt_calendar0001",
	slug: "calendar-event",
	id: "evt_calendar0001",
	name: "Calendar Event",
	day: "saturday",
	date,
	time: "20:00",
	endTime: "23:00",
	arrondissement: 11,
	location: "Paris",
	link: "https://example.com",
	type: getEventTypeForDate(date),
	genre: ["afrobeats"],
	venueTypes: ["indoor"],
	indoor: true,
	sourceConfirmed: true,
});

describe("calendar utils", () => {
	it("validates strict ISO calendar dates", () => {
		expect(isCalendarDateValid("2026-06-21")).toBe(true);
		expect(isCalendarDateValid("2026-02-30")).toBe(false);
		expect(isCalendarDateValid("21 June 2026")).toBe(false);
	});

	it("generates ICS content for valid event dates", () => {
		const content = generateICSContent(makeEvent("2026-06-21"));

		expect(content).toContain("BEGIN:VCALENDAR");
		expect(content).toContain("BEGIN:VEVENT");
		expect(content).toContain("SUMMARY:Calendar Event");
	});

	it("uses transparent price range copy in calendar descriptions", () => {
		const content = generateICSContent({
			...makeEvent("2026-06-21"),
			price: "€28.00 - €35.84",
		});

		expect(content).toContain("Price: €28.00 - €35.84");
	});

	it("uses the concrete venue for single-location calendar exports", () => {
		const content = generateICSContent({
			...makeEvent("2026-06-21"),
			location: "Le Klub",
			arrondissement: 11,
		});

		expect(content).toContain(
			"LOCATION:Le Klub\\, 11e Arrondissement\\, Paris\\, France",
		);
	});

	it("uses listed venue names for multi-location calendar exports", () => {
		const content = generateICSContent({
			...makeEvent("2026-06-21"),
			arrondissement: "multiple-locations",
			location: "Multiple locations",
			locations: ["Venue A", "Hidden Loft"],
			locationEntries: [
				{ name: "Venue A", arrondissement: 10 },
				{ name: "Hidden Loft", arrondissement: 11 },
			],
		});

		expect(content).toContain(
			"LOCATION:Venue A (10e) / Hidden Loft (11e)\\, Paris\\, France",
		);
	});

	it("uses a clear placeholder for unlisted multi-location calendar exports", () => {
		const content = generateICSContent({
			...makeEvent("2026-06-21"),
			arrondissement: "multiple-locations",
			location: "Multiple locations",
			locations: [],
		});

		expect(content).toContain("LOCATION:Multiple locations\\, Paris\\, France");
	});

	it("uses Location TBC for unknown calendar locations", () => {
		const content = generateICSContent({
			...makeEvent("2026-06-21"),
			location: "TBC",
		});

		expect(content).toContain("LOCATION:Location TBC");
	});

	it("returns empty content when event date is invalid", () => {
		const content = generateICSContent(makeEvent("2026-02-30"));
		expect(content).toBe("");
	});
});
