import {
	DEFAULT_EVENT_FILTER_STATE,
	filterEvents,
	getAvailableEventExperienceCategories,
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
	it("supports including one genre while excluding another", () => {
		const events = [
			makeEvent(["afrobeats"], "afrobeats"),
			makeEvent(["afrobeats", "amapiano"], "afrobeats-amapiano"),
			makeEvent(["soca"], "soca"),
		];

		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				selectedGenres: ["afrobeats"],
				excludedGenres: ["amapiano"],
			}).map((event) => event.eventKey),
		).toEqual(["evt_test_afrobeats"]);
	});

	it("can show events that do not include an excluded genre", () => {
		const events = [
			makeEvent(["afrobeats"], "afrobeats"),
			makeEvent(["amapiano"], "amapiano"),
			makeEvent(["soca", "amapiano"], "soca-amapiano"),
		];

		expect(
			filterEvents(events, {
				...DEFAULT_EVENT_FILTER_STATE,
				excludedGenres: ["amapiano"],
			}).map((event) => event.eventKey),
		).toEqual(["evt_test_afrobeats"]);
	});

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

	it("keeps free-only price filtering strict unless free options are included", () => {
		const trulyFree = {
			...makeEvent(["amapiano"], "true-free"),
			price: "Free",
		};
		const freeOption = {
			...makeEvent(["amapiano"], "free-option"),
			price: "Free - £10",
		};

		expect(
			filterEvents([trulyFree, freeOption], {
				...DEFAULT_EVENT_FILTER_STATE,
				selectedPriceRange: [0, 0],
			}).map((event) => event.eventKey),
		).toEqual(["evt_test_true-free"]);

		expect(
			filterEvents([trulyFree, freeOption], {
				...DEFAULT_EVENT_FILTER_STATE,
				selectedPriceRange: [0, 0],
				includeFreeOptions: true,
			}).map((event) => event.eventKey),
		).toEqual(["evt_test_true-free", "evt_test_free-option"]);
	});

	it("filters explicit event categories and exposes only categories in data", () => {
		const party = {
			...makeEvent(["afrobeats"], "party"),
			eventCategory: "party" as const,
		};
		const activity = {
			...makeEvent(["afrobeats"], "activity"),
			eventCategory: "activity" as const,
		};
		const uncategorized = makeEvent(["afrobeats"], "uncategorized");

		expect(
			getAvailableEventExperienceCategories([party, activity, uncategorized]),
		).toEqual(["party", "activity"]);
		expect(
			filterEvents([party, activity, uncategorized], {
				...DEFAULT_EVENT_FILTER_STATE,
				selectedEventCategories: ["activity"],
			}).map((event) => event.eventKey),
		).toEqual(["evt_test_activity"]);
		expect(
			filterEvents([activity], {
				...DEFAULT_EVENT_FILTER_STATE,
				searchQuery: "activity",
			}),
		).toHaveLength(1);
	});
});
