import { describe, expect, it } from "vitest";
import {
	generateICSContent,
	isCalendarDateValid,
} from "@/features/events/calendar-utils";
import type { Event } from "@/features/events/types";

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
	type: "Day Party",
	genre: ["afrobeats"],
	venueTypes: ["indoor"],
	indoor: true,
	verified: true,
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

	it("returns empty content when event date is invalid", () => {
		const content = generateICSContent(makeEvent("2026-02-30"));
		expect(content).toBe("");
	});
});
