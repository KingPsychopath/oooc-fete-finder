import type { Event } from "@/features/events/types";
import {
	getDefaultPlanDate,
	getPlanDateOptions,
} from "@/features/plans/plan-date-options";
import { describe, expect, it } from "vitest";

const eventForDate = (date: string, key: string): Event =>
	({
		eventKey: key,
		date,
		name: key,
		type: "Pre-Fete",
		time: "12:00",
		arrondissement: "1e",
	}) as unknown as Event;

describe("plan date options", () => {
	it("only shows current Paris year dates when current-year events exist", () => {
		const events = [
			eventForDate("2025-06-19", "old"),
			eventForDate("2026-06-19", "current-1"),
			eventForDate("2026-06-20", "current-2"),
		];

		expect(
			getPlanDateOptions(events, new Date("2026-06-01T12:00:00Z")),
		).toEqual(["2026-06-19", "2026-06-20"]);
	});

	it("falls back to all dates when no current-year events exist", () => {
		const events = [
			eventForDate("2025-06-19", "old-1"),
			eventForDate("2025-06-20", "old-2"),
		];

		expect(
			getPlanDateOptions(events, new Date("2026-06-01T12:00:00Z")),
		).toEqual(["2025-06-19", "2025-06-20"]);
	});

	it("chooses the default from visible date options", () => {
		const events = [
			eventForDate("2025-06-19", "old"),
			eventForDate("2026-06-19", "current-1"),
			eventForDate("2026-06-19", "current-2"),
			eventForDate("2026-06-19", "current-3"),
			eventForDate("2026-06-20", "current-4"),
		];

		expect(getDefaultPlanDate(events, new Date("2026-06-01T12:00:00Z"))).toBe(
			"2026-06-19",
		);
	});
});
