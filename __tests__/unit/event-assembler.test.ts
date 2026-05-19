import {
	assembleEvent,
	assembleEvents,
} from "@/features/data-management/assembly/event-assembler";
import type { CSVEventRow } from "@/features/data-management/csv/parser";
import { WarningSystem } from "@/features/data-management/validation/date-warnings";
import { describe, expect, it } from "vitest";

const baseRow: CSVEventRow = {
	eventKey: "",
	curated: "",
	hostCountry: "🇫🇷",
	audienceCountry: "",
	title: "Sunset Party",
	date: "21 June",
	startTime: "18:00",
	endTime: "23:00",
	location: "Paris",
	districtArea: "11",
	categories: "Afrobeats",
	tags: "",
	price: "Free",
	primaryUrl: "https://example.com/event",
	ageGuidance: "18+",
	setting: "Indoor",
	notes: "Bring ID",
};

describe("event assembler identity", () => {
	it("uses explicit canonical eventKey when provided", () => {
		const row: CSVEventRow = {
			...baseRow,
			eventKey: "evt_abcdef123456",
			title: "IMERSIV Summer Party - Day 1",
		};
		const event = assembleEvent(row, 0);

		expect(event.eventKey).toBe("evt_abcdef123456");
		expect(event.id).toBe(event.eventKey);
		expect(event.slug).toBe("imersiv-summer-party-day-1");
	});

	it("generates deterministic unique event keys when missing", () => {
		const rows: CSVEventRow[] = [
			{ ...baseRow, eventKey: "", title: "Duplicate Event" },
			{ ...baseRow, eventKey: "", title: "Duplicate Event" },
		];
		const events = assembleEvents(rows);

		expect(events).toHaveLength(2);
		expect(events[0].eventKey.startsWith("evt_")).toBe(true);
		expect(events[1].eventKey.startsWith("evt_")).toBe(true);
		expect(events[0].eventKey).not.toBe(events[1].eventKey);
		expect(events[0].id).toBe(events[0].eventKey);
		expect(events[1].id).toBe(events[1].eventKey);
	});

	it("derives day from explicit year dates", () => {
		WarningSystem.clearDateFormatWarnings();
		const event = assembleEvent({ ...baseRow, date: "2026-06-21" }, 0, {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});

		expect(event.date).toBe("2026-06-21");
		expect(event.day).toBe("sunday");
	});

	it("keeps rows with invalid dates as tbc and empty date", () => {
		WarningSystem.clearDateFormatWarnings();
		const event = assembleEvent({ ...baseRow, date: "31/02/2026" }, 0, {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});

		expect(event.date).toBe("");
		expect(event.day).toBe("tbc");
		expect(WarningSystem.getDateFormatWarnings()).toHaveLength(1);
		expect(WarningSystem.getDateFormatWarnings()[0].warningType).toBe(
			"invalid",
		);
	});

	it("marks events as needing review when only one essential detail is present", () => {
		const event = assembleEvent(
			{
				...baseRow,
				startTime: "18:00",
				price: "",
				primaryUrl: "",
			},
			0,
		);

		expect(event.detailsQuality).toBe("review");
		expect(event.detailsQualitySource).toBe("inferred");
		expect(event.sourceConfirmed).toBe(false);
	});

	it("uses explicit source confirmation values", () => {
		const unconfirmed = assembleEvent(
			{
				...baseRow,
				sourceConfirmed: "false",
			},
			0,
		);
		const confirmed = assembleEvent(
			{
				...baseRow,
				location: "",
				districtArea: "",
				date: "",
				sourceConfirmed: "true",
			},
			0,
		);

		expect(unconfirmed.sourceConfirmed).toBe(false);
		expect(confirmed.sourceConfirmed).toBe(true);
	});

	it("respects manual details quality overrides", () => {
		const event = assembleEvent(
			{
				...baseRow,
				detailsQualityOverride: "review",
			},
			0,
		);

		expect(event.detailsQuality).toBe("review");
		expect(event.detailsQualitySource).toBe("manual");
	});

	it("unions host and audience country for nationality parsing", () => {
		const event = assembleEvent(
			{
				...baseRow,
				hostCountry: "FR",
				audienceCountry: "CA",
			},
			0,
		);

		expect(event.nationality).toEqual(expect.arrayContaining(["FR", "CA"]));
		expect(event.hostCountries).toEqual(["FR"]);
		expect(event.audienceCountries).toEqual(["CA"]);
	});

	it("maps francophone categories into the canonical genre list", () => {
		const event = assembleEvent(
			{
				...baseRow,
				categories: "Francophone, Shatta",
			},
			0,
		);

		expect(event.genre).toEqual(["francophone", "shatta"]);
	});

	it("maps aliases and standalone tags for afrohouse, slow jams, and 3-step", () => {
		const event = assembleEvent(
			{
				...baseRow,
				categories: "Afrohouse, Slow Jams, 3step",
			},
			0,
		);

		expect(event.genre).toEqual(["afro house", "slow jams", "3-step"]);
	});

	it("maps both rnb and r&b into the canonical r&b genre", () => {
		const fromAlias = assembleEvent(
			{
				...baseRow,
				categories: "RNB",
			},
			0,
		);
		const fromAmpersand = assembleEvent(
			{
				...baseRow,
				categories: "R&B",
			},
			0,
		);

		expect(fromAlias.genre).toEqual(["r&b"]);
		expect(fromAmpersand.genre).toEqual(["r&b"]);
	});

	it("treats afrotrap as its own canonical genre", () => {
		const event = assembleEvent(
			{
				...baseRow,
				categories: "Afrotrap",
			},
			0,
		);

		expect(event.genre).toEqual(["afrotrap"]);
	});

	it("preserves CSV-only live genres instead of collapsing them into other", () => {
		const event = assembleEvent(
			{
				...baseRow,
				categories: "Bachata, Batida, Edits, Reggae, Salsa",
			},
			0,
		);

		expect(event.genre).toEqual([
			"bachata",
			"batida",
			"edits",
			"reggae",
			"salsa",
		]);
	});

	it("supports explicit multiple-location events", () => {
		const event = assembleEvent(
			{
				...baseRow,
				location: "Venue A | Venue B",
				districtArea: "Multiple Locations",
			},
			0,
		);

		expect(event.arrondissement).toBe("multiple-locations");
		expect(event.location).toBe("Multiple locations");
		expect(event.locations).toEqual(["Venue A", "Venue B"]);
		expect(event.locationEntries).toEqual([
			{ name: "Venue A" },
			{ name: "Venue B" },
		]);
	});

	it("pairs multiple locations with area list entries by order", () => {
		const event = assembleEvent(
			{
				...baseRow,
				location: "Venue A | Venue B",
				districtArea: "10e | 11e",
			},
			0,
		);

		expect(event.arrondissement).toBe("multiple-locations");
		expect(event.locationEntries).toEqual([
			{ name: "Venue A", arrondissement: 10 },
			{ name: "Venue B", arrondissement: 11 },
		]);
	});

	it("applies one shared area to every listed location without creating one event pin", () => {
		const event = assembleEvent(
			{
				...baseRow,
				location: "Venue A | Venue B",
				districtArea: "10e",
			},
			0,
		);

		expect(event.arrondissement).toBe("multiple-locations");
		expect(event.location).toBe("Multiple locations");
		expect(event.locationEntries).toEqual([
			{ name: "Venue A", arrondissement: 10 },
			{ name: "Venue B", arrondissement: 10 },
		]);
	});

	it("supports multiple-location events without exact venues", () => {
		const event = assembleEvent(
			{
				...baseRow,
				location: "",
				districtArea: "Multiple Locations",
			},
			0,
		);

		expect(event.arrondissement).toBe("multiple-locations");
		expect(event.location).toBeUndefined();
		expect(event.locations).toBeUndefined();
	});

	it("preserves metadata tags from the csv row", () => {
		const event = assembleEvent(
			{
				...baseRow,
				tags: "roof, free, roof",
			},
			0,
		);

		expect(event.tags).toEqual(["roof", "free"]);
	});

	it("expands Date To ranges into one occurrence per day", () => {
		const events = assembleEvents([
			{
				...baseRow,
				title: "Weekend Session",
				date: "18 June 2026",
				dateTo: "20 June 2026",
			},
		]);

		expect(events).toHaveLength(3);
		expect(events.map((event) => event.date)).toEqual([
			"2026-06-18",
			"2026-06-19",
			"2026-06-20",
		]);
		expect(events.every((event) => event.seriesKey?.startsWith("ser_"))).toBe(
			true,
		);
		expect(events.map((event) => event.occurrenceIndex)).toEqual([0, 1, 2]);
		expect(events.every((event) => event.occurrenceCount === 3)).toBe(true);
		expect(events.every((event) => event.dateRangeStart === "2026-06-18")).toBe(
			true,
		);
		expect(events.every((event) => event.dateRangeEnd === "2026-06-20")).toBe(
			true,
		);
	});

	it("keeps an explicit event key for the first range occurrence and generates the rest", () => {
		const events = assembleEvents([
			{
				...baseRow,
				eventKey: "evt_explicitrange123",
				seriesKey: "ser_explicitrange12",
				date: "18 June 2026",
				dateTo: "20 June 2026",
			},
		]);

		expect(events).toHaveLength(3);
		expect(events[0].eventKey).toBe("evt_explicitrange123");
		expect(events[1].eventKey).not.toBe("evt_explicitrange123");
		expect(events[1].eventKey).not.toBe(events[2].eventKey);
		expect(
			events.every((event) => event.seriesKey === "ser_explicitrange12"),
		).toBe(true);
	});

	it("falls back to a single occurrence and warns when Date To is before Date", () => {
		WarningSystem.clearDateFormatWarnings();
		const events = assembleEvents([
			{
				...baseRow,
				title: "Backwards Range",
				date: "20 June 2026",
				dateTo: "18 June 2026",
			},
		]);

		expect(events).toHaveLength(1);
		expect(events[0].date).toBe("2026-06-20");
		expect(
			WarningSystem.getDateFormatWarnings().some(
				(warning) =>
					warning.columnType === "dateTo" && warning.warningType === "invalid",
			),
		).toBe(true);
	});

	it("preserves multiple locations, multiple links, and non-number areas across range occurrences", () => {
		const events = assembleEvents([
			{
				...baseRow,
				title: "Travelling Weekender",
				date: "18 June 2026",
				dateTo: "19 June 2026",
				location: "Venue A | Venue B",
				districtArea: "Multiple Locations",
				primaryUrl: "example.com/a | https://example.com/b",
			},
		]);

		expect(events).toHaveLength(2);
		for (const event of events) {
			expect(event.arrondissement).toBe("multiple-locations");
			expect(event.location).toBe("Multiple locations");
			expect(event.locations).toEqual(["Venue A", "Venue B"]);
			expect(event.link).toBe("https://example.com/a");
			expect(event.links).toEqual([
				"https://example.com/a",
				"https://example.com/b",
			]);
			expect(event.seriesKey?.startsWith("ser_")).toBe(true);
		}
	});
});
