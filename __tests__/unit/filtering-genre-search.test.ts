import {
	DEFAULT_EVENT_FILTER_STATE,
	filterEvents,
} from "@/features/events/filtering";
import { type Event, getEventTypeForDate } from "@/features/events/types";
import { describe, expect, it } from "vitest";

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
	sourceConfirmed: true,
});

describe("genre-aware search filtering", () => {
	it("matches alias search terms against canonical genres", () => {
		const events = [
			makeEvent(["r&b"], "rnb"),
			makeEvent(["afro house"], "afrohouse"),
			makeEvent(["coupé-décalé"], "coupe-decale"),
			makeEvent(["kompa"], "kompa"),
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
		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "konpa",
			}),
		).toHaveLength(1);
	});

	it("matches static chip concepts for price, night, and ordinal date", () => {
		const event = {
			...makeEvent(["amapiano"], "chip-concepts"),
			date: "2026-06-21",
			time: "23:30",
			price: "Free entry",
		};

		expect(
			filterEvents([event], {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "Free",
			}),
		).toHaveLength(1);
		expect(
			filterEvents([event], {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "Night",
			}),
		).toHaveLength(1);
		expect(
			filterEvents([event], {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "21st",
			}),
		).toHaveLength(1);
	});
});
