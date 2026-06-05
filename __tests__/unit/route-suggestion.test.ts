import type { Event } from "@/features/events/types";
import { buildSuggestedPlans } from "@/features/plans/route-suggestion";
import { describe, expect, it } from "vitest";

const event = (overrides: Partial<Event>): Event =>
	({
		eventKey: overrides.eventKey ?? "event-1",
		slug: overrides.slug ?? overrides.eventKey ?? "event-1",
		id: overrides.id ?? overrides.eventKey ?? "event-1",
		name: overrides.name ?? overrides.eventKey ?? "Event",
		day: "friday",
		date: overrides.date ?? "2026-06-19",
		time: overrides.time ?? "18:00",
		endTime: overrides.endTime,
		arrondissement: overrides.arrondissement ?? 10,
		coordinates: overrides.coordinates,
		link: "#",
		type: "Fete",
		eventCategory: overrides.eventCategory ?? "party",
		genre: overrides.genre ?? [],
		venueTypes: [],
		indoor: true,
		price: overrides.price,
		isOOOCPick: overrides.isOOOCPick,
		socialProofSaveCount: overrides.socialProofSaveCount,
		category: overrides.category,
	}) as Event;

describe("buildSuggestedPlans", () => {
	it("returns deterministic suggestions from the same canonical inputs", () => {
		const events = [
			event({
				eventKey: "saved-party",
				name: "Saved Party",
				time: "21:00",
				coordinates: { lat: 48.866, lng: 2.36 },
			}),
			event({
				eventKey: "culture-stop",
				name: "Culture Stop",
				time: "18:00",
				eventCategory: "culture",
				coordinates: { lat: 48.864, lng: 2.35 },
			}),
			event({
				eventKey: "food-stop",
				name: "Food Stop",
				time: "19:30",
				eventCategory: "food",
				coordinates: { lat: 48.862, lng: 2.34 },
			}),
			event({
				eventKey: "other-day",
				name: "Other Day",
				date: "2026-06-20",
			}),
		];

		const first = buildSuggestedPlans({
			events,
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
				startPeriod: "evening",
				vibes: ["culture", "food"],
				travelTolerance: "close",
			},
			signals: {
				savedEventKeys: ["saved-party"],
			},
		});
		const second = buildSuggestedPlans({
			events,
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
				startPeriod: "evening",
				vibes: ["culture", "food"],
				travelTolerance: "close",
			},
			signals: {
				savedEventKeys: ["saved-party"],
			},
		});

		expect(second).toEqual(first);
		expect(first[0]?.eventKeys).toEqual([
			"culture-stop",
			"food-stop",
			"saved-party",
		]);
		expect(first[0]?.reasons.join(" ")).toContain("saved");
	});

	it("locks must-include events into suggestions", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "locked", time: "20:00" }),
				event({ eventKey: "nearby", time: "18:00" }),
				event({ eventKey: "third", time: "22:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 2,
				mustIncludeEventKeys: ["locked"],
			},
		});

		expect(suggestions[0]?.eventKeys).toContain("locked");
		expect(suggestions[0]?.eventKeys).toHaveLength(2);
	});

	it("keeps every locked event even when locked count exceeds requested stops", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "locked-1", time: "18:00" }),
				event({ eventKey: "locked-2", time: "19:00" }),
				event({ eventKey: "locked-3", time: "20:00" }),
				event({ eventKey: "strong-extra", time: "21:00", isOOOCPick: true }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 2,
				mustIncludeEventKeys: ["locked-1", "locked-2", "locked-3"],
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual([
			"locked-1",
			"locked-2",
			"locked-3",
		]);
	});

	it("can suggest a five stop route", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "first", time: "17:00" }),
				event({ eventKey: "second", time: "18:00" }),
				event({ eventKey: "third", time: "19:00" }),
				event({ eventKey: "fourth", time: "20:00" }),
				event({ eventKey: "fifth", time: "21:00" }),
				event({ eventKey: "sixth", time: "22:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 5,
			},
		});

		expect(suggestions[0]?.eventKeys).toHaveLength(5);
	});

	it("treats free budget as a strict price constraint", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({
					eventKey: "paid-with-free-copy-1",
					name: "Paid With Free Copy 1",
					price: "€38.71",
					time: "18:00",
					isOOOCPick: true,
				}),
				event({
					eventKey: "paid-with-free-copy-2",
					name: "Paid With Free Copy 2",
					price: "€10.00",
					time: "19:00",
					socialProofSaveCount: 10,
				}),
				event({
					eventKey: "free-1",
					name: "Free One",
					price: "Free",
					time: "20:00",
				}),
				event({
					eventKey: "free-2",
					name: "Free Two",
					price: "0€",
					time: "21:00",
				}),
				event({
					eventKey: "unknown",
					name: "Unknown Price",
					price: "TBC",
					time: "22:00",
				}),
			],
			date: "2026-06-19",
			preferences: {
				budget: "free",
				stopCount: 3,
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual(["free-1", "free-2"]);
	});

	it("allows pinned stops to override a free budget rebuild", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({
					eventKey: "pinned-paid",
					name: "Pinned Paid",
					price: "€38.71",
					time: "18:00",
				}),
				event({
					eventKey: "free-1",
					name: "Free One",
					price: "Free",
					time: "20:00",
				}),
				event({
					eventKey: "free-2",
					name: "Free Two",
					price: "0€",
					time: "21:00",
				}),
			],
			date: "2026-06-19",
			preferences: {
				budget: "free",
				stopCount: 3,
				mustIncludeEventKeys: ["pinned-paid"],
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual([
			"pinned-paid",
			"free-1",
			"free-2",
		]);
	});

	it("excludes current unpinned stops when building a regenerated route", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "current-1", time: "18:00", isOOOCPick: true }),
				event({ eventKey: "current-2", time: "19:00", isOOOCPick: true }),
				event({ eventKey: "next-1", time: "20:00" }),
				event({ eventKey: "next-2", time: "21:00" }),
				event({ eventKey: "next-3", time: "22:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
			},
			excludedEventKeys: ["current-1", "current-2"],
		});

		expect(suggestions[0]?.eventKeys).toEqual(["next-1", "next-2", "next-3"]);
	});

	it("does not exclude pinned stops during regeneration", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "pinned", time: "18:00" }),
				event({ eventKey: "current-2", time: "19:00", isOOOCPick: true }),
				event({ eventKey: "next-1", time: "20:00" }),
				event({ eventKey: "next-2", time: "21:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
				mustIncludeEventKeys: ["pinned"],
			},
			excludedEventKeys: ["pinned", "current-2"],
		});

		expect(suggestions[0]?.eventKeys).toEqual(["pinned", "next-1", "next-2"]);
	});

	it("keeps smart and low-travel when they produce different routes", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({
					eventKey: "popular-anchor",
					time: "18:00",
					isOOOCPick: true,
					socialProofSaveCount: 20,
					coordinates: { lat: 48.86, lng: 2.35 },
				}),
				event({
					eventKey: "pick-far",
					time: "19:00",
					isOOOCPick: true,
					coordinates: { lat: 48.89, lng: 2.42 },
				}),
				event({
					eventKey: "popular-far",
					time: "20:00",
					socialProofSaveCount: 20,
					coordinates: { lat: 48.83, lng: 2.28 },
				}),
				event({
					eventKey: "near-one",
					time: "19:00",
					coordinates: { lat: 48.861, lng: 2.351 },
				}),
				event({
					eventKey: "near-two",
					time: "20:00",
					coordinates: { lat: 48.862, lng: 2.352 },
				}),
			],
			date: "2026-06-19",
			preferences: {
				budget: "any",
				stopCount: 3,
			},
		});

		expect(suggestions.map((suggestion) => suggestion.mode)).toEqual([
			"balanced",
			"close",
		]);
		expect(suggestions.map((suggestion) => suggestion.title)).toContain(
			"Low-travel route",
		);
	});

	it("prefers route stops with at least an hour between event starts", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "saved-start", time: "18:00" }),
				event({
					eventKey: "too-soon",
					time: "18:30",
					isOOOCPick: true,
					socialProofSaveCount: 10,
				}),
				event({ eventKey: "one-hour-later", time: "19:00" }),
				event({ eventKey: "two-hours-later", time: "20:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
			},
			signals: {
				savedEventKeys: ["saved-start"],
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual([
			"saved-start",
			"one-hour-later",
			"two-hours-later",
		]);
	});

	it("uses the selected period as first-stop intent and builds forward", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({
					eventKey: "saved-lunch",
					time: "12:00",
					isOOOCPick: true,
				}),
				event({ eventKey: "evening-first", time: "18:00" }),
				event({ eventKey: "evening-second", time: "19:00" }),
				event({ eventKey: "late-third", time: "22:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
				startPeriod: "evening",
			},
			signals: {
				savedEventKeys: ["saved-lunch"],
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual([
			"evening-first",
			"evening-second",
			"late-third",
		]);
	});

	it("can treat an exact route start as planned arrival at an already-started event", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({
					eventKey: "already-open",
					time: "12:30",
					isOOOCPick: true,
					socialProofSaveCount: 10,
				}),
				event({ eventKey: "after-start", time: "15:00" }),
				event({ eventKey: "later", time: "16:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
				routeStartTime: "14:00",
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual([
			"already-open",
			"after-start",
			"later",
		]);
	});

	it("fills around a pinned middle stop as a time anchor", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "before-anchor", time: "10:00" }),
				event({ eventKey: "too-many-before", time: "11:00" }),
				event({ eventKey: "pinned-middle", time: "12:00" }),
				event({ eventKey: "after-anchor", time: "14:00" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 3,
				startPeriod: "day",
				mustIncludeEventKeys: ["pinned-middle"],
				anchoredStops: [{ eventKey: "pinned-middle", stopOrder: 2 }],
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual([
			"before-anchor",
			"pinned-middle",
			"after-anchor",
		]);
	});

	it("falls back to tighter timing when there are not enough spaced stops", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "first", time: "18:00" }),
				event({ eventKey: "only-other-option", time: "18:30" }),
			],
			date: "2026-06-19",
			preferences: {
				stopCount: 2,
			},
		});

		expect(suggestions[0]?.eventKeys).toEqual(["first", "only-other-option"]);
	});

	it("does not show duplicate suggestions for the same ordered route", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "one", time: "18:00" }),
				event({ eventKey: "two", time: "19:00" }),
				event({ eventKey: "three", time: "20:00" }),
			],
			date: "2026-06-19",
			preferences: {
				budget: "any",
				stopCount: 3,
			},
			signals: {
				savedEventKeys: ["one", "two", "three"],
			},
		});

		expect(suggestions.map((suggestion) => suggestion.mode)).toEqual([
			"balanced",
		]);
	});

	it("does not add a saved-first fallback when there are not enough saved events", () => {
		const suggestions = buildSuggestedPlans({
			events: [
				event({ eventKey: "one", time: "18:00" }),
				event({ eventKey: "two", time: "19:00" }),
				event({ eventKey: "three", time: "20:00" }),
			],
			date: "2026-06-19",
			preferences: {
				budget: "any",
				stopCount: 3,
			},
			signals: {
				savedEventKeys: ["one"],
			},
		});

		expect(suggestions.map((suggestion) => suggestion.mode)).toEqual([
			"balanced",
		]);
	});
});
