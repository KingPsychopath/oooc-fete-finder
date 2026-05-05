import { describe, expect, it } from "vitest";
import { createRegularEventsComparator } from "@/features/events/ordering";
import { getEventTypeForDate, type Event } from "@/features/events/types";

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
	verified: true,
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
