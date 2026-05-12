import {
	getParisSpotlightRotationDate,
	getSpotlightRotationContext,
	selectFeaturedEvents,
} from "@/features/events/featured/selection";
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

	it("keeps featured placements ahead even after their event time has passed", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "featured-passed",
					date: "2026-06-19",
					time: "18:00",
					isFeatured: true,
				}),
				makeEvent({
					eventKey: "soon-regular",
					date: "2026-06-21",
					time: "18:00",
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-21T12:00:00.000Z"),
		});

		expect(selected.map((event) => event.eventKey)).toEqual([
			"featured-passed",
			"soon-regular",
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

	it("rotates fallback ranking by Paris calendar day", () => {
		const events = [
			makeEvent({ eventKey: "regular-a", date: "2026-06-21" }),
			makeEvent({ eventKey: "regular-b", date: "2026-06-22" }),
			makeEvent({ eventKey: "regular-c", date: "2026-06-23" }),
			makeEvent({ eventKey: "regular-d", date: "2026-06-24" }),
			makeEvent({ eventKey: "regular-e", date: "2026-06-25" }),
			makeEvent({ eventKey: "regular-f", date: "2026-06-26" }),
		];
		const firstSelection = selectFeaturedEvents({
			events,
			maxFeaturedEvents: 6,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
			rotationDate: "2026-05-12",
		});
		const nextDaySelection = selectFeaturedEvents({
			events,
			maxFeaturedEvents: 6,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
			rotationDate: "2026-05-13",
		});

		expect(nextDaySelection.map((event) => event.eventKey)).not.toEqual(
			firstSelection.map((event) => event.eventKey),
		);
	});

	it("keeps existing fallback relative order when a same-range event is added", () => {
		const events = [
			makeEvent({ eventKey: "regular-a", date: "2026-06-21" }),
			makeEvent({ eventKey: "regular-b", date: "2026-06-22" }),
			makeEvent({ eventKey: "regular-c", date: "2026-06-23" }),
			makeEvent({ eventKey: "regular-d", date: "2026-06-24" }),
		];
		const baseSelection = selectFeaturedEvents({
			events,
			maxFeaturedEvents: 4,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
			rotationDate: "2026-05-12",
		});
		const withAddedSelection = selectFeaturedEvents({
			events: [
				...events,
				makeEvent({ eventKey: "regular-x", date: "2026-06-24" }),
			],
			maxFeaturedEvents: 5,
			dateRange,
			referenceDate: new Date("2026-06-20T12:00:00"),
			rotationDate: "2026-05-12",
		});

		expect(
			withAddedSelection
				.map((event) => event.eventKey)
				.filter((eventKey) => eventKey !== "regular-x"),
		).toEqual(baseSelection.map((event) => event.eventKey));
	});

	it("uses the Paris day for the default rotation date", () => {
		expect(
			getParisSpotlightRotationDate(new Date("2026-05-12T21:59:00.000Z")),
		).toBe("2026-05-12");
		expect(
			getParisSpotlightRotationDate(new Date("2026-05-12T22:00:00.000Z")),
		).toBe("2026-05-13");
	});

	it("uses daily cadence far from fete and six-hour mood buckets near fete", () => {
		const farContext = getSpotlightRotationContext({
			dateRange,
			referenceDate: new Date("2026-05-12T12:00:00.000Z"),
		});
		const eveningContext = getSpotlightRotationContext({
			dateRange,
			referenceDate: new Date("2026-06-21T17:30:00.000Z"),
		});
		const lateContext = getSpotlightRotationContext({
			dateRange,
			referenceDate: new Date("2026-06-21T22:30:00.000Z"),
		});

		expect(farContext).toMatchObject({
			cadence: "daily",
			bucket: "daily",
			eventPhase: "far",
		});
		expect(eveningContext).toMatchObject({
			cadence: "six-hour",
			bucket: "evening",
			eventPhase: "event-day",
		});
		expect(lateContext).toMatchObject({
			cadence: "six-hour",
			bucket: "late",
			eventPhase: "event-day",
		});
		expect(lateContext.rotationDate).toBe("2026-06-22");
	});

	it("uses bucket intent to prefer evening events during evening rotation", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "morning-market",
					date: "2026-06-21",
					time: "10:00",
					genre: ["other"],
					tags: ["market"],
					venueTypes: ["outdoor"],
					indoor: false,
				}),
				makeEvent({
					eventKey: "evening-dj",
					date: "2026-06-21",
					time: "20:00",
					genre: ["house"],
					tags: ["dj"],
					venueTypes: ["indoor"],
					indoor: true,
				}),
			],
			maxFeaturedEvents: 1,
			dateRange,
			referenceDate: new Date("2026-06-21T16:00:00.000Z"),
			rotationContext: getSpotlightRotationContext({
				dateRange,
				referenceDate: new Date("2026-06-21T16:00:00.000Z"),
			}),
		});

		expect(selected.map((event) => event.eventKey)).toEqual(["evening-dj"]);
	});

	it("prefers near peak-date events over far-away fallbacks when enough exist", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "far-social-proof",
					date: "2026-06-28",
					time: "20:00",
					socialProofSaveCount: 999,
				}),
				makeEvent({ eventKey: "near-a", date: "2026-06-21", time: "18:00" }),
				makeEvent({ eventKey: "near-b", date: "2026-06-21", time: "20:00" }),
				makeEvent({ eventKey: "near-c", date: "2026-06-22", time: "16:00" }),
			],
			maxFeaturedEvents: 3,
			dateRange,
			referenceDate: new Date("2026-06-21T12:00:00.000Z"),
			rotationContext: getSpotlightRotationContext({
				dateRange,
				referenceDate: new Date("2026-06-21T12:00:00.000Z"),
			}),
		});

		expect(selected.map((event) => event.eventKey)).not.toContain(
			"far-social-proof",
		);
	});

	it("uses a start-time ladder on event day", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({ eventKey: "tomorrow", date: "2026-06-22", time: "18:00" }),
				makeEvent({
					eventKey: "later-tonight",
					date: "2026-06-21",
					time: "23:00",
				}),
				makeEvent({
					eventKey: "starting-soon",
					date: "2026-06-21",
					time: "18:30",
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-21T16:00:00.000Z"),
			rotationContext: getSpotlightRotationContext({
				dateRange,
				referenceDate: new Date("2026-06-21T16:00:00.000Z"),
			}),
		});

		expect(selected.map((event) => event.eventKey)).toEqual([
			"starting-soon",
			"later-tonight",
		]);
	});

	it("applies a soft diversity guard for venue, genre, and arrondissement", () => {
		const selected = selectFeaturedEvents({
			events: [
				makeEvent({
					eventKey: "same-venue-a",
					date: "2026-06-21",
					time: "18:00",
					location: "Venue A",
					arrondissement: 11,
					genre: ["house"],
					socialProofSaveCount: 80,
				}),
				makeEvent({
					eventKey: "same-venue-b",
					date: "2026-06-21",
					time: "18:30",
					location: "Venue A",
					arrondissement: 11,
					genre: ["house"],
					socialProofSaveCount: 70,
				}),
				makeEvent({
					eventKey: "different-area",
					date: "2026-06-21",
					time: "19:00",
					location: "Venue B",
					arrondissement: 18,
					genre: ["soca"],
				}),
			],
			maxFeaturedEvents: 2,
			dateRange,
			referenceDate: new Date("2026-06-21T15:00:00.000Z"),
			rotationContext: getSpotlightRotationContext({
				dateRange,
				referenceDate: new Date("2026-06-21T15:00:00.000Z"),
			}),
		});

		expect(selected.map((event) => event.eventKey)).toContain("different-area");
		expect(new Set(selected.map((event) => event.location)).size).toBe(2);
	});
});
