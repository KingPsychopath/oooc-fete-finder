import type { Event } from "@/features/events/types";
import { mergePinnedStopsIntoRoute } from "@/features/plans/pinned-route-merge";
import type { UserPlanStop } from "@/features/plans/types";
import { describe, expect, it } from "vitest";

const event = (eventKey: string): Event =>
	({
		eventKey,
		id: eventKey,
		slug: eventKey,
		name: eventKey,
		date: "2026-06-19",
		day: "friday",
		time: "18:00",
		link: "#",
		type: "Fete",
		eventCategory: "party",
		genre: [],
		venueTypes: [],
		indoor: true,
	}) as Event;

const stop = (
	eventKey: string,
	stopOrder: number,
	locked = true,
): UserPlanStop =>
	({
		id: eventKey,
		eventKey,
		stopOrder,
		locked,
		arrivalTime: null,
		departureTime: null,
		travelMinutesFromPrevious: null,
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
	}) satisfies UserPlanStop;

describe("mergePinnedStopsIntoRoute", () => {
	it("keeps pinned events in their existing stop positions", () => {
		const pinned = event("pinned");
		const proposedEvents = [event("new-first"), pinned, event("new-third")];
		const merged = mergePinnedStopsIntoRoute({
			proposedEvents,
			existingStops: [stop("pinned", 3)],
			eventsByKey: new Map(proposedEvents.map((item) => [item.eventKey, item])),
		});

		expect(merged.map((item) => item.eventKey)).toEqual([
			"new-first",
			"new-third",
			"pinned",
		]);
	});

	it("keeps a pinned event even if the proposed route omitted it", () => {
		const pinned = event("pinned");
		const proposedEvents = [event("new-first"), event("new-second")];
		const merged = mergePinnedStopsIntoRoute({
			proposedEvents,
			existingStops: [stop("pinned", 2)],
			eventsByKey: new Map([
				...proposedEvents.map((item) => [item.eventKey, item] as const),
				[pinned.eventKey, pinned],
			]),
		});

		expect(merged.map((item) => item.eventKey)).toEqual([
			"new-first",
			"pinned",
		]);
	});
});
