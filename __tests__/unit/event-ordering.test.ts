import {
	createFreshActivityComparator,
	createRegularEventsComparator,
} from "@/features/events/ordering";
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

describe("createRegularEventsComparator", () => {
	it("orders upcoming events first, ascending by date/time, then past events oldest-first", () => {
		const now = new Date("2026-06-21T12:00:00");
		const events: Event[] = [
			makeEvent({
				eventKey: "event-e",
				date: "2026-06-22",
				time: "18:00",
			}),
			makeEvent({
				eventKey: "event-d",
				date: "2026-06-20",
				time: "20:00",
			}),
			makeEvent({
				eventKey: "event-c",
				date: "2026-06-20",
				time: "23:00",
			}),
			makeEvent({
				eventKey: "event-b",
				date: "2026-06-22",
				time: "09:00",
			}),
			makeEvent({
				eventKey: "event-a",
				date: "2026-06-22",
			}),
		];

		const sorted = [...events].sort(createRegularEventsComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual([
			"event-b",
			"event-e",
			"event-a",
			"event-d",
			"event-c",
		]);
	});

	it("treats missing/unknown times as late evening (23:59) for deterministic ordering", () => {
		const now = new Date("2026-06-21T12:00:00");
		const events: Event[] = [
			makeEvent({
				eventKey: "known-2100",
				date: "2026-06-22",
				time: "21:00",
			}),
			makeEvent({
				eventKey: "late-unknown",
				date: "2026-06-22",
			}),
			makeEvent({
				eventKey: "late-tbc",
				date: "2026-06-22",
				time: "TBC",
			}),
		];

		const sorted = [...events].sort(createRegularEventsComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual([
			"known-2100",
			"late-tbc",
			"late-unknown",
		]);
	});

	it("places invalid dates at the end of regular ordering", () => {
		const now = new Date("2026-06-21T12:00:00");
		const events: Event[] = [
			makeEvent({ eventKey: "valid", date: "2026-06-22", time: "09:00" }),
			makeEvent({ eventKey: "invalid", date: "2026-13-01", time: "09:00" }),
		];

		const sorted = [...events].sort(createRegularEventsComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual(["valid", "invalid"]);
	});

	it("uses deterministic tie-breakers when date/time matches", () => {
		const now = new Date("2026-06-21T12:00:00");
		const events: Event[] = [
			makeEvent({
				eventKey: "zeta",
				date: "2026-06-22",
				time: "11:00",
				name: "Zulu",
			}),
			makeEvent({
				eventKey: "alpha",
				date: "2026-06-22",
				time: "11:00",
				name: "Alpha",
			}),
		];

		const sorted = [...events].sort(createRegularEventsComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual(["alpha", "zeta"]);
	});
});

describe("createFreshActivityComparator", () => {
	it("lifts new, updated, and strongly saved events before regular ordering", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const events: Event[] = [
			makeEvent({
				eventKey: "soon-regular",
				date: "2026-06-20",
				time: "18:00",
			}),
			makeEvent({
				eventKey: "saved",
				date: "2026-06-22",
				socialProofSaveCount: 8,
			}),
			makeEvent({
				eventKey: "updated",
				date: "2026-06-22",
				firstSeenAt: "2026-04-20T12:00:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T08:00:00.000Z",
			}),
			makeEvent({
				eventKey: "new",
				date: "2026-06-22",
				firstSeenAt: "2026-05-08T08:00:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T08:00:00.000Z",
			}),
		];

		const sorted = [...events].sort(createFreshActivityComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual([
			"new",
			"updated",
			"saved",
			"soon-regular",
		]);
	});

	it("keeps updated events above regular events even when saves are high", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const events: Event[] = [
			makeEvent({
				eventKey: "many-saves",
				date: "2026-06-20",
				socialProofSaveCount: 999,
			}),
			makeEvent({
				eventKey: "updated",
				date: "2026-06-22",
				firstSeenAt: "2026-04-20T12:00:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T08:00:00.000Z",
			}),
		];

		const sorted = [...events].sort(createFreshActivityComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual([
			"updated",
			"many-saves",
		]);
	});

	it("orders new events before updated events, then by exact activity timestamp", () => {
		const now = new Date("2026-05-08T12:00:00.000Z");
		const events: Event[] = [
			makeEvent({
				eventKey: "new-earliest",
				date: "2026-06-20",
				firstSeenAt: "2026-05-08T08:15:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T08:15:00.000Z",
			}),
			makeEvent({
				eventKey: "new-latest",
				date: "2026-06-20",
				firstSeenAt: "2026-05-08T09:15:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T09:15:00.000Z",
			}),
			makeEvent({
				eventKey: "updated-latest",
				date: "2026-06-22",
				firstSeenAt: "2026-04-20T12:00:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T10:30:00.000Z",
			}),
			makeEvent({
				eventKey: "updated-middle",
				date: "2026-06-21",
				firstSeenAt: "2026-04-20T12:00:00.000Z",
				lastMeaningfulChangeAt: "2026-05-08T09:45:00.000Z",
			}),
		];

		const sorted = [...events].sort(createFreshActivityComparator(now));
		expect(sorted.map((event) => event.eventKey)).toEqual([
			"new-latest",
			"new-earliest",
			"updated-latest",
			"updated-middle",
		]);
	});
});
