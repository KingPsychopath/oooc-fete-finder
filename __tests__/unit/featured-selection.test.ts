import { selectFeaturedEvents } from "@/features/events/featured/selection";
import { type Event, getEventTypeForDate } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const makeEvent = ({
	eventKey,
	date,
	...overrides
}: Partial<Event> & { eventKey: string; date: string }): Event => ({
	slug: eventKey,
	id: eventKey,
	name: eventKey,
	day: "friday",
	date,
	arrondissement: 11,
	link: "https://example.com",
	type: getEventTypeForDate(date),
	genre: ["Afrobeats"],
	venueTypes: ["indoor"],
	indoor: true,
	sourceConfirmed: true,
	...overrides,
	eventKey,
});

describe("selectFeaturedEvents", () => {
	const dateRange = {
		from: "2026-01-01",
		to: "2026-12-31",
	};

	it("prioritizes active placements before fallback picks", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "oooc-pick",
					date: "2026-06-21",
					isOOOCPick: true,
				}),
				makeEvent({
					eventKey: "featured",
					date: "2026-06-21",
					isFeatured: true,
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});

		expect(selected.map((event) => event.eventKey)).toEqual([
			"featured",
			"oooc-pick",
		]);
	});

	it("includes an OOOC pick when placement slots leave room", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({ eventKey: "regular-a", date: "2026-06-21" }),
				makeEvent({
					eventKey: "oooc-pick",
					date: "2026-06-21",
					isOOOCPick: true,
				}),
				makeEvent({ eventKey: "regular-b", date: "2026-06-22" }),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});

		expect(selected.some((event) => event.isOOOCPick)).toBe(true);
	});

	it("limits OOOC pick fallback to one slot when regular candidates exist", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "oooc-pick-a",
					date: "2026-06-21",
					isOOOCPick: true,
				}),
				makeEvent({
					eventKey: "oooc-pick-b",
					date: "2026-06-22",
					isOOOCPick: true,
				}),
				makeEvent({ eventKey: "regular-a", date: "2026-06-21" }),
				makeEvent({ eventKey: "regular-b", date: "2026-06-22" }),
			],
			maxFeaturedEvents: 3,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});

		expect(selected.filter((event) => event.isOOOCPick).length).toBe(1);
		expect(selected.filter((event) => !event.isOOOCPick).length).toBe(2);
	});

	it("does not use passed events as fallback cards", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "passed-pick",
					date: "2026-06-19",
					time: "18:00",
					isOOOCPick: true,
				}),
				makeEvent({
					eventKey: "upcoming-regular",
					date: "2026-06-21",
					time: "18:00",
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});

		expect(selected.map((event) => event.eventKey)).toEqual([
			"upcoming-regular",
		]);
	});

	it("uses a seeded archive fallback when every non-placement event has passed", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "passed-pick",
					date: "2026-06-19",
					time: "18:00",
					isOOOCPick: true,
				}),
				makeEvent({
					eventKey: "passed-regular",
					date: "2026-06-19",
					time: "20:00",
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-28T12:00:00"),
		});

		expect(selected.map((event) => event.eventKey).sort()).toEqual([
			"passed-pick",
			"passed-regular",
		]);
	});

	it("keeps promoted events eligible even after their event time has passed", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "promoted-passed",
					date: "2026-06-19",
					time: "18:00",
					isPromoted: true,
				}),
				makeEvent({
					eventKey: "upcoming-regular",
					date: "2026-06-21",
					time: "18:00",
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});

		expect(selected.map((event) => event.eventKey)).toEqual([
			"promoted-passed",
			"upcoming-regular",
		]);
	});

	it("is deterministic for the same date set", () => {
		const events = [
			makeEvent({ eventKey: "regular-a", date: "2026-06-21" }),
			makeEvent({ eventKey: "regular-b", date: "2026-06-22" }),
			makeEvent({ eventKey: "regular-c", date: "2026-06-23" }),
		];
		const firstSelection = selectFeaturedEvents({
			events,
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});
		const secondSelection = selectFeaturedEvents({
			events,
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
		});

		expect(secondSelection.map((event) => event.eventKey)).toEqual(
			firstSelection.map((event) => event.eventKey),
		);
	});
});
