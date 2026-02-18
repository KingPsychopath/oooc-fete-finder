import { describe, expect, it } from "vitest";
import {
	assembleEvent,
	assembleEvents,
} from "@/features/data-management/assembly/event-assembler";
import type { CSVEventRow } from "@/features/data-management/csv/parser";

const baseRow: CSVEventRow = {
	eventKey: "",
	oocPicks: "",
	nationality: "🇫🇷",
	name: "Sunset Party",
	date: "21 June",
	startTime: "18:00",
	endTime: "23:00",
	location: "Paris",
	arrondissement: "11",
	genre: "Afrobeats",
	price: "Free",
	ticketLink: "https://example.com/event",
	age: "18+",
	indoorOutdoor: "Indoor",
	notes: "Bring ID",
	featured: "",
};

describe("event assembler identity", () => {
	it("uses explicit canonical eventKey when provided", () => {
		const row: CSVEventRow = {
			...baseRow,
			eventKey: "evt_abcdef123456",
			name: "IMERSIV Summer Party - Day 1",
		};
		const event = assembleEvent(row, 0);

		expect(event.eventKey).toBe("evt_abcdef123456");
		expect(event.id).toBe(event.eventKey);
		expect(event.slug).toBe("imersiv-summer-party-day-1");
	});

	it("generates deterministic unique event keys when missing", () => {
		const rows: CSVEventRow[] = [
			{ ...baseRow, eventKey: "", name: "Duplicate Event" },
			{ ...baseRow, eventKey: "", name: "Duplicate Event" },
		];
		const events = assembleEvents(rows);

		expect(events).toHaveLength(2);
		expect(events[0].eventKey.startsWith("evt_")).toBe(true);
		expect(events[1].eventKey.startsWith("evt_")).toBe(true);
		expect(events[0].eventKey).not.toBe(events[1].eventKey);
		expect(events[0].id).toBe(events[0].eventKey);
		expect(events[1].id).toBe(events[1].eventKey);
	});
});

