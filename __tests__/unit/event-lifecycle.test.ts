import {
	getEventLifecycleStatus,
	isEventDiscoverableByDefault,
} from "@/features/events/lifecycle";
import { type Event, getEventTypeForDate } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const makeEvent = ({
	date,
	time,
	endTime,
}: {
	date: string;
	time?: string;
	endTime?: string;
}): Event => ({
	eventKey: `evt_${date}_${time ?? "none"}`,
	slug: `event-${date}`,
	id: `evt_${date}_${time ?? "none"}`,
	name: "Lifecycle event",
	day: "friday",
	date,
	time,
	endTime,
	arrondissement: 11,
	link: "https://example.com",
	type: getEventTypeForDate(date),
	genre: ["afrobeats"],
	venueTypes: ["indoor"],
	indoor: true,
	sourceConfirmed: true,
});

describe("event lifecycle", () => {
	it("keeps overnight events live after midnight in Paris", () => {
		const event = makeEvent({
			date: "2026-06-20",
			time: "22:00",
			endTime: "04:00",
		});
		const referenceDate = new Date("2026-06-21T01:30:00.000Z");

		expect(getEventLifecycleStatus(event, referenceDate)).toBe("live");
		expect(
			isEventDiscoverableByDefault(event, {
				dateRange: { from: "2026-06-21", to: "2026-12-31" },
				referenceDate,
			}),
		).toBe(true);
	});

	it("hides yesterday events after their lifecycle window has passed", () => {
		const event = makeEvent({
			date: "2026-06-20",
			time: "18:00",
			endTime: "20:00",
		});
		const referenceDate = new Date("2026-06-21T12:00:00.000Z");

		expect(getEventLifecycleStatus(event, referenceDate)).toBe("past");
		expect(
			isEventDiscoverableByDefault(event, {
				dateRange: { from: "2026-06-21", to: "2026-12-31" },
				referenceDate,
			}),
		).toBe(false);
	});

	it("keeps unknown-time events through their local event date", () => {
		const event = makeEvent({ date: "2026-06-21" });

		expect(
			getEventLifecycleStatus(
				event,
				new Date("2026-06-21T18:00:00.000Z"),
			),
		).toBe("live");
		expect(
			isEventDiscoverableByDefault(event, {
				dateRange: { from: "2026-06-21", to: "2026-12-31" },
				referenceDate: new Date("2026-06-21T18:00:00.000Z"),
			}),
		).toBe(true);
	});

	it("marks unknown-time events past after the local event date", () => {
		const event = makeEvent({ date: "2026-06-21" });

		expect(
			isEventDiscoverableByDefault(event, {
				dateRange: { from: "2026-06-22", to: "2026-12-31" },
				referenceDate: new Date("2026-06-22T12:00:00.000Z"),
			}),
		).toBe(false);
	});
});
