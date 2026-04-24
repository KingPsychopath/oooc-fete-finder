import { describe, expect, it } from "vitest";
import {
	DEFAULT_EVENT_FILTER_STATE,
	filterEvents,
} from "@/features/events/filtering";
import { getEventTypeForDate, type Event } from "@/features/events/types";

const makeEvent = (genre: Event["genre"], suffix: string): Event => ({
	eventKey: `evt_test_${suffix}`,
	slug: `test-event-${suffix}`,
	id: `evt_test_${suffix}`,
	name: `Test Event ${suffix}`,
	day: "friday",
	date: "2026-06-21",
	arrondissement: 11,
	link: "https://example.com",
	type: getEventTypeForDate("2026-06-21"),
	genre,
	venueTypes: ["indoor"],
	indoor: true,
	verified: true,
});

describe("genre-aware search filtering", () => {
	it("matches alias search terms against canonical genres", () => {
		const events = [
			makeEvent(["r&b"], "rnb"),
			makeEvent(["afro house"], "afrohouse"),
			makeEvent(["coupé-décalé"], "coupe-decale"),
		];

		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "rnb",
			}),
		).toHaveLength(1);
		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "afrohouse",
			}),
		).toHaveLength(1);
		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "coupe decale",
			}),
		).toHaveLength(1);
	});
});
