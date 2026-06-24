import {
	buildDynamicSearchChipDebugMatches,
	buildDynamicSearchChips,
	buildStaticSearchChips,
} from "@/features/events/search-chips";
import { type Event, getEventTypeForDate } from "@/features/events/types";
import { describe, expect, it } from "vitest";

const UPCOMING_TEST_DATE = "2099-06-21";
const CURRENT_PARIS_YEAR = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Paris",
	year: "numeric",
}).format(new Date());
const CURRENT_YEAR_TEST_DATE = `${CURRENT_PARIS_YEAR}-12-31`;
const OLD_TEST_DATE = "2025-06-21";

const makeEvent = (overrides: Partial<Event>): Event => {
	const date = overrides.date ?? UPCOMING_TEST_DATE;
	return {
		eventKey: `evt_${overrides.id ?? "test"}`,
		slug: `event-${overrides.id ?? "test"}`,
		id: `evt_${overrides.id ?? "test"}`,
		name: "Amapiano Night",
		day: "saturday",
		date,
		time: "23:00",
		arrondissement: 19,
		location: "Le Sample",
		link: "https://example.com",
		type: getEventTypeForDate(date),
		genre: ["amapiano"],
		tags: ["Rooftop"],
		venueTypes: ["indoor"],
		indoor: true,
		price: "Free",
		sourceConfirmed: true,
		...overrides,
	};
};

describe("search chips", () => {
	it("builds curated static chips", () => {
		expect(buildStaticSearchChips().map((chip) => chip.label)).toEqual([
			"Night",
			"Free",
			"21st",
			"OOOC",
			"R&B",
			"Afrobeats",
			"Konpa",
			"Amapiano",
		]);
	});

	it("canonicalizes popular typo signals without exposing raw query text", () => {
		const chips = buildDynamicSearchChips(
			[
				{ query: "amapano", count: 6, recentCount: 3 },
				{ query: "roof top", count: 5, recentCount: 2 },
			],
			[
				makeEvent({ id: "one", tags: ["Rooftop"], genre: ["amapiano"] }),
				makeEvent({ id: "two", tags: ["Rooftop"], genre: ["amapiano"] }),
			],
			{ staticQueries: ["Free"], maxChips: 4 },
		);

		expect(chips).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: "Amapiano", source: "popular" }),
				expect.objectContaining({ label: "Rooftop", source: "popular" }),
			]),
		);
		expect(chips.map((chip) => chip.label)).not.toContain("amapano");
	});

	it("excludes unsafe, low-count, static, and zero-result signals", () => {
		const chips = buildDynamicSearchChips(
			[
				{ query: "Free", count: 20, recentCount: 10 },
				{ query: "someone@example.com", count: 20, recentCount: 10 },
				{ query: "Rooftop", count: 1, recentCount: 1 },
				{ query: "unknown concept", count: 8, recentCount: 8 },
			],
			[makeEvent({ id: "one", tags: ["Rooftop"] })],
			{ staticQueries: ["Free"], maxChips: 4 },
		);

		expect(chips).toEqual([]);
	});

	it("returns no dynamic chips when there are no recent search signals", () => {
		expect(buildDynamicSearchChips([], [makeEvent({ id: "one" })])).toEqual([]);
	});

	it("includes listed multi-location venue chips but not the placeholder", () => {
		const chips = buildDynamicSearchChips(
			[
				{ query: "Hidden Loft", count: 10, recentCount: 4 },
				{ query: "Multiple locations", count: 10, recentCount: 4 },
			],
			[
				makeEvent({
					id: "multi",
					arrondissement: "multiple-locations",
					location: "Multiple locations",
					locations: ["Venue A", "Hidden Loft"],
					locationEntries: [
						{ name: "Venue A", arrondissement: 10 },
						{ name: "Hidden Loft", arrondissement: 11 },
					],
				}),
			],
			{ staticQueries: [], maxChips: 4 },
		);

		expect(chips).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: "Hidden Loft", kind: "venue" }),
			]),
		);
		expect(chips.map((chip) => chip.label)).not.toContain("Multiple locations");
	});

	it("caps dynamic chips", () => {
		const chips = buildDynamicSearchChips(
			[
				{ query: "Rooftop", count: 5 },
				{ query: "Amapiano", count: 5 },
				{ query: "Saturday", count: 5 },
			],
			[
				makeEvent({ id: "one", tags: ["Rooftop"], genre: ["amapiano"] }),
				makeEvent({ id: "two", tags: ["Terrace"], genre: ["kompa"] }),
			],
			{ staticQueries: [], maxChips: 2 },
		);

		expect(chips).toHaveLength(2);
	});

	it("includes shortened event-title chips when event searches are popular", () => {
		const chips = buildDynamicSearchChips(
			[
				{
					query: "La Sunday Abidjan",
					count: 30,
					recentCount: 12,
					sources: ["input"],
				},
				{
					query: "This is LA VIE (Saturday)",
					count: 28,
					recentCount: 11,
					sources: ["input"],
				},
				{ query: "Saturday", count: 4, recentCount: 2 },
			],
			[
				makeEvent({
					id: "event-title",
					name: "La Sunday Abidjan",
					day: "saturday",
				}),
				makeEvent({
					id: "long-event-title",
					name: "This is LA VIE (Saturday)",
					day: "saturday",
				}),
			],
			{ staticQueries: [], maxChips: 4 },
		);

		expect(chips).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: "La Sunday Abidjan",
					query: "La Sunday Abidjan",
					source: "popular",
				}),
				expect.objectContaining({
					label: "This is LA VIE...",
					query: "This is LA VIE (Saturday)",
					source: "popular",
				}),
			]),
		);
	});

	it("does not promote an event title from a broad facet search", () => {
		const chips = buildDynamicSearchChips(
			[{ query: "free", count: 20, recentCount: 8, sources: ["curated_chip"] }],
			[
				makeEvent({
					id: "free-youth",
					name: "SSSOUND x Free the Youth",
				}),
			],
			{ staticQueries: [], maxChips: 4 },
		);

		expect(chips.map((chip) => chip.query)).not.toContain(
			"SSSOUND x Free the Youth",
		);
		expect(chips).toEqual([
			expect.objectContaining({ query: "Free", kind: "facet" }),
		]);
	});

	it("requires typed input before promoting exact event-title signals", () => {
		const chips = buildDynamicSearchChips(
			[
				{
					query: "La Sunday Abidjan",
					count: 30,
					recentCount: 12,
					sources: ["curated_chip"],
				},
			],
			[makeEvent({ id: "event-title", name: "La Sunday Abidjan" })],
			{ staticQueries: [], maxChips: 4 },
		);

		expect(chips.map((chip) => chip.query)).not.toContain("La Sunday Abidjan");
	});

	it("excludes old event-title candidates when newer in-range events exist", () => {
		const chips = buildDynamicSearchChips(
			[
				{
					query: "SSSOUND x Free the Youth",
					count: 20,
					recentCount: 8,
					sources: ["input"],
				},
			],
			[
				makeEvent({
					id: "old-free-youth",
					name: "SSSOUND x Free the Youth",
					date: OLD_TEST_DATE,
				}),
				makeEvent({
					id: "upcoming",
					name: "Amapiano Night",
					date: CURRENT_YEAR_TEST_DATE,
				}),
			],
			{ staticQueries: [], maxChips: 4 },
		);

		expect(chips.map((chip) => chip.query)).not.toContain(
			"SSSOUND x Free the Youth",
		);
	});

	it("can explain the signal behind a popular chip", () => {
		const matches = buildDynamicSearchChipDebugMatches(
			[
				{
					query: "La Sunday Abidjan",
					count: 30,
					recentCount: 12,
					lastSeenAt: "2026-05-19T10:00:00.000Z",
					sources: ["input"],
				},
			],
			[makeEvent({ id: "event-title", name: "La Sunday Abidjan" })],
			{ staticQueries: [], maxChips: 4 },
		);

		expect(matches).toEqual([
			expect.objectContaining({
				label: "La Sunday Abidjan",
				eventDate: UPCOMING_TEST_DATE,
				matchedSignalQuery: "La Sunday Abidjan",
				matchedSignalCount: 30,
				matchedSignalSources: ["input"],
			}),
		]);
	});

	it("suppresses repeated event chips when alternatives exist", () => {
		const chips = buildDynamicSearchChips(
			[
				{
					query: "Repeated Event",
					count: 60,
					recentCount: 20,
					sources: ["input"],
				},
				{
					query: "Fresh Event",
					count: 30,
					recentCount: 10,
					sources: ["input"],
				},
				{
					query: "Another Fresh Event",
					count: 25,
					recentCount: 8,
					sources: ["input"],
				},
			],
			[
				makeEvent({ id: "repeated", name: "Repeated Event" }),
				makeEvent({ id: "fresh", name: "Fresh Event" }),
				makeEvent({ id: "another-fresh", name: "Another Fresh Event" }),
			],
			{
				staticQueries: [],
				maxChips: 4,
				suppressedEventQueries: ["Repeated Event"],
			},
		);

		expect(chips.map((chip) => chip.query)).not.toContain("Repeated Event");
		expect(chips).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ query: "Fresh Event", kind: "event" }),
				expect.objectContaining({
					query: "Another Fresh Event",
					kind: "event",
				}),
			]),
		);
	});

	it("falls back to suppressed event chips when there are not enough alternatives", () => {
		const chips = buildDynamicSearchChips(
			[
				{
					query: "Repeated Event",
					count: 60,
					recentCount: 20,
					sources: ["input"],
				},
			],
			[makeEvent({ id: "repeated", name: "Repeated Event" })],
			{
				staticQueries: [],
				maxChips: 4,
				suppressedEventQueries: ["Repeated Event"],
			},
		);

		expect(chips).toEqual([
			expect.objectContaining({ query: "Repeated Event", kind: "event" }),
		]);
	});

	it("prefers organic event chips over paid placements when scores are close", () => {
		const chips = buildDynamicSearchChips(
			[
				{
					query: "Promoted Event",
					count: 20,
					recentCount: 8,
					sources: ["input"],
				},
				{
					query: "Organic Event",
					count: 19,
					recentCount: 8,
					sources: ["input"],
				},
			],
			[
				makeEvent({
					id: "promoted",
					name: "Promoted Event",
					isPromoted: true,
				}),
				makeEvent({ id: "organic", name: "Organic Event" }),
			],
			{ staticQueries: [], maxChips: 1 },
		);

		expect(chips).toEqual([
			expect.objectContaining({ query: "Organic Event", kind: "event" }),
		]);
	});
});
