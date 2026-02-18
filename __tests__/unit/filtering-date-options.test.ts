import { describe, expect, it } from "vitest";
import { getAvailableEventDates } from "@/features/events/filtering";
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

describe("getAvailableEventDates", () => {
	it("returns only strict ISO dates in sorted order", () => {
		const dates = getAvailableEventDates([
			makeEvent("2027-06-21", 1),
			makeEvent("2026-06-22", 2),
			makeEvent("2026-02-30", 3),
			makeEvent("21 June 2026", 4),
			makeEvent("", 5),
			makeEvent("2026-06-22", 6),
		]);

		expect(dates).toEqual(["2026-06-22", "2027-06-21"]);
	});
});
