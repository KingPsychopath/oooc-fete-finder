import { describe, expect, it } from "vitest";
import type { Event } from "@/features/events/types";
import {
	getFeaturedEventExpirationDate,
	isFeaturedEventExpired,
	shouldDisplayFeaturedEvent,
} from "@/features/events/featured/utils/timestamp-utils";

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
	eventKey: "evt_test",
	slug: "event-test",
	id: "event_test",
	name: "Event Test",
	day: "saturday",
	date: "2026-06-21",
	time: "18:00",
	arrondissement: 1,
	link: "https://example.com",
	type: "Day Party",
	genre: ["house"],
	venueTypes: ["indoor"],
	indoor: true,
	verified: true,
	...overrides,
});

describe("featured timestamp utils", () => {
	it("keeps featured events visible while featuredEndsAt is in the future", () => {
		const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
		const event = makeEvent({
			isFeatured: true,
			featuredAt: "2026-01-01T00:00:00.000Z",
			featuredEndsAt: futureEnd,
		});

		expect(shouldDisplayFeaturedEvent(event)).toBe(true);
		expect(
			isFeaturedEventExpired(event.featuredAt, 48, event.featuredEndsAt),
		).toBe(false);
	});

	it("hides featured events when featuredEndsAt is in the past", () => {
		const pastEnd = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		const event = makeEvent({
			isFeatured: true,
			featuredAt: "2026-01-01T00:00:00.000Z",
			featuredEndsAt: pastEnd,
		});

		expect(shouldDisplayFeaturedEvent(event)).toBe(false);
		expect(
			isFeaturedEventExpired(event.featuredAt, 48, event.featuredEndsAt),
		).toBe(true);
	});

	it("returns scheduler end date when featuredEndsAt exists", () => {
		const endIso = "2026-06-23T10:00:00.000Z";
		const expiration = getFeaturedEventExpirationDate(
			"2026-06-21T10:00:00.000Z",
			48,
			endIso,
		);

		expect(expiration?.toISOString()).toBe(endIso);
	});
});
