import type { Event } from "@/features/events/types";
import { buildPlanWithAddedEvent } from "@/features/plans/add-event-to-plan";
import { describe, expect, it } from "vitest";

const event = (overrides: Partial<Event> = {}): Event =>
	({
		eventKey: overrides.eventKey ?? "event-1",
		id: overrides.id ?? overrides.eventKey ?? "event-1",
		name: overrides.name ?? "Event One",
		date: overrides.date ?? "2026-06-21",
		time: overrides.time ?? "15:00",
		endTime: overrides.endTime,
	}) as Event;

describe("buildPlanWithAddedEvent", () => {
	it("creates a readable deterministic title for modal-started plans", () => {
		const plan = buildPlanWithAddedEvent(event(), undefined);

		expect(plan.title).toBe("Route for Sun 21 Jun");
		expect(plan.stops).toEqual([
			expect.objectContaining({
				eventKey: "event-1",
				stopOrder: 1,
				locked: true,
			}),
		]);
	});
});
