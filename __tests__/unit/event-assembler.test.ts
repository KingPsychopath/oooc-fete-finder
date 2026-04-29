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

	it("marks events unverified when only one essential detail is present", () => {
		const event = assembleEvent(
			{
				...baseRow,
				startTime: "18:00",
				price: "",
				primaryUrl: "",
			},
			0,
		);

		expect(event.verified).toBe(false);
	});

	it("respects explicit verified override from CSV", () => {
		const unverified = assembleEvent(
			{
				...baseRow,
				verified: "false",
			},
			0,
		);
		const verified = assembleEvent(
			{
				...baseRow,
				location: "",
				districtArea: "",
				date: "",
				verified: "true",
			},
			0,
		);

		expect(unverified.verified).toBe(false);
		expect(verified.verified).toBe(true);
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
});
