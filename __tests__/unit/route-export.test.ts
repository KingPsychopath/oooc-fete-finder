import type { Event } from "@/features/events/types";
import {
	buildRouteMapTarget,
	generateRouteICSContent,
} from "@/features/plans/route-export";
import type { UserPlan } from "@/features/plans/types";
import { describe, expect, it } from "vitest";

const event = (overrides: Partial<Event>): Event =>
	({
		eventKey: overrides.eventKey ?? "event-1",
		slug: overrides.slug ?? overrides.eventKey ?? "event-1",
		id: overrides.id ?? overrides.eventKey ?? "event-1",
		name: overrides.name ?? "Event",
		day: "friday",
		date: overrides.date ?? "2026-06-19",
		time: overrides.time ?? "18:00",
		endTime: overrides.endTime,
		arrondissement: overrides.arrondissement ?? 10,
		location: overrides.location ?? "Venue",
		coordinates: overrides.coordinates,
		link: overrides.link ?? "#",
		type: "Fete",
		eventCategory: overrides.eventCategory ?? "party",
		genre: [],
		venueTypes: [],
		indoor: true,
	}) as Event;

const plan: UserPlan = {
	id: "plan-1",
	userId: null,
	ownerKey: "owner",
	planDate: "2026-06-19",
	title: "Route for Fri 19 Jun",
	visibility: "private",
	shareToken: null,
	shareOwnerNameVisible: true,
	stops: [],
	createdAt: "2026-06-01T00:00:00.000Z",
	updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("route export", () => {
	it("exports one calendar event per stop in route order", () => {
		const content = generateRouteICSContent(
			plan,
			[
				event({ eventKey: "first", name: "First Stop", time: "18:00" }),
				event({ eventKey: "second", name: "Second Stop", time: "20:00" }),
			],
			new Date("2026-06-01T10:00:00.000Z"),
		);

		expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
		expect(content).toContain("SUMMARY:Stop 1: First Stop");
		expect(content).toContain("SUMMARY:Stop 2: Second Stop");
		expect(content.indexOf("First Stop")).toBeLessThan(
			content.indexOf("Second Stop"),
		);
		expect(content).toContain("DTSTART;TZID=Europe/Paris:20260619T180000");
	});

	it("builds a full Google route with waypoints", () => {
		const target = buildRouteMapTarget(
			[
				event({ coordinates: { lat: 48.86, lng: 2.35 } }),
				event({
					eventKey: "middle",
					coordinates: { lat: 48.87, lng: 2.36 },
				}),
				event({ eventKey: "last", coordinates: { lat: 48.88, lng: 2.37 } }),
			],
			"google",
		);

		expect(target?.coverage).toBe("full-route");
		expect(target?.url).toContain("google.com/maps/dir");
		expect(target?.url).toContain("origin=48.86%2C2.35");
		expect(target?.url).toContain("waypoints=48.87%2C2.36");
		expect(target?.url).toContain("destination=48.88%2C2.37");
		expect(target?.url).toContain("travelmode=walking");
	});

	it("uses Apple Maps for the first leg when Apple is explicitly selected", () => {
		const target = buildRouteMapTarget(
			[
				event({ coordinates: { lat: 48.86, lng: 2.35 } }),
				event({
					eventKey: "second",
					coordinates: { lat: 48.87, lng: 2.36 },
				}),
				event({ eventKey: "third", coordinates: { lat: 48.88, lng: 2.37 } }),
			],
			"apple",
		);

		expect(target?.coverage).toBe("first-leg");
		expect(target?.url).toContain("maps.apple.com");
		expect(target?.url).toContain("saddr=48.86%2C2.35");
		expect(target?.url).toContain("daddr=48.87%2C2.36");
		expect(target?.url).toContain("dirflg=w");
	});
});
