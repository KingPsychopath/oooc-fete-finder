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

	it("excludes non-canonical human date labels from plan day options", () => {
		const events = [
			eventForDate("2026-06-21", "current-1"),
			eventForDate(" My June 22nd ", "bad-human-label"),
			eventForDate("2026-06-22", "current-2"),
		];

		expect(
			getPlanDateOptions(events, new Date("2026-06-01T12:00:00Z")),
		).toEqual(["2026-06-21", "2026-06-22"]);
	});

	it("prefers the 21st when it is available in visible date options", () => {
		const events = [
			eventForDate("2025-06-19", "old"),
			eventForDate("2026-06-19", "current-1"),
			eventForDate("2026-06-19", "current-2"),
			eventForDate("2026-06-19", "current-3"),
			eventForDate("2026-06-20", "current-4"),
			eventForDate("2026-06-21", "current-5"),
		];

		expect(getDefaultPlanDate(events, new Date("2026-06-01T12:00:00Z"))).toBe(
			"2026-06-21",
		);
	});

	it("falls back to the busiest visible date when the 21st is unavailable", () => {
		const events = [
			eventForDate("2025-06-21", "old"),
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
