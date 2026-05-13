import { toHomepageEventPayload } from "@/features/events/homepage-event-payload";
import type { Event } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const baseEvent = {
	eventKey: "evt_test",
	slug: "test-event",
	id: "evt_test",
	name: "Test Event",
	day: "friday",
	date: "2026-06-19",
	time: "20:00",
	endTime: "02:00",
	arrondissement: 19,
	location: "La Petite Halle",
	coordinates: { lat: 48.888, lng: 2.394 },
	locationResolution: {
		coordinates: { lat: 48.888, lng: 2.394 },
		source: "geocoded",
		precision: "venue",
		confidence: 0.96,
		formattedAddress: "211 Avenue Jean Jaures, Paris",
		provider: "manual",
		providerPlaceId: "place_test",
		query: "La Petite Halle Paris",
		lastResolvedAt: "2026-05-08T00:00:00.000Z",
	},
	link: "https://example.com",
	links: ["https://example.com"],
	description:
		"A full description should remain available for lightweight search.",
	type: "Pre-Fete",
	genre: ["soul", "hip-hop"],
	tags: ["live"],
	venueTypes: ["indoor", "outdoor"],
	indoor: true,
	price: "Free",
	age: "18+",
	hostCountries: ["FR"],
	audienceCountries: ["GB"],
	nationality: ["FR"],
} satisfies Event;

describe("toHomepageEventPayload", () => {
	it("keeps coordinates in the initial homepage payload for map pins", () => {
		const payload = toHomepageEventPayload(baseEvent);

		expect(payload).not.toBe(baseEvent);
		expect(payload.coordinates).toEqual(baseEvent.coordinates);
	});

	it("keeps list, card, search, and selected-event modal fields", () => {
		const payload = toHomepageEventPayload(baseEvent);

		expect(payload.eventKey).toBe(baseEvent.eventKey);
		expect(payload.slug).toBe(baseEvent.slug);
		expect(payload.name).toBe(baseEvent.name);
		expect(payload.date).toBe(baseEvent.date);
		expect(payload.location).toBe(baseEvent.location);
		expect(payload.genre).toEqual(baseEvent.genre);
		expect(payload.description).toBe(baseEvent.description);
		expect(payload.locationResolution).toEqual(baseEvent.locationResolution);
		expect(payload.hostCountries).toEqual(baseEvent.hostCountries);
		expect(payload.audienceCountries).toEqual(baseEvent.audienceCountries);
	});
});
