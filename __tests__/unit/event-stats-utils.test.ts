import {
	getEventStatsDateRange,
	getEventStatsUniqueDays,
} from "@/features/events/event-stats-utils";
import { describe, expect, it } from "vitest";

describe("event stats utils", () => {
	it("shows the full explicit range even when there is a far-year date", () => {
		const result = getEventStatsDateRange([
			{ date: "1990-02-25", day: "sunday" },
			{ date: "not-a-date", day: "friday" },
			{ date: "", day: "tbc" },
			{ date: "2026-02-21", day: "saturday" },
			{ date: "2026-02-22", day: "sunday" },
			{ date: "2026-02-25", day: "wednesday" },
		]);

		expect(result.label).toBe("February 25, 1990 - February 25, 2026");
		expect(result.earliestDate).toBe("1990-02-25");
		expect(result.latestDate).toBe("2026-02-25");
		expect(result.spanDays).toBeGreaterThan(365);
	});

	it("returns Dates TBD when there are no valid ISO dates", () => {
		expect(
			getEventStatsDateRange([
				{ date: "" },
				{ date: "June 21" },
				{ date: "2026-02-30" },
			]),
		).toEqual({
			label: "Dates TBD",
			spanDays: null,
			earliestDate: null,
			latestDate: null,
		});
	});

	it("counts unique non-tbc days only", () => {
		expect(
			getEventStatsUniqueDays([
				{ day: "friday" },
				{ day: "friday" },
				{ day: "saturday" },
				{ day: "tbc" },
				{},
			]),
		).toBe(2);
	});
});
