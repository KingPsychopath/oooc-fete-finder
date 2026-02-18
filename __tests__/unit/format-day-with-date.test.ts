import { describe, expect, it } from "vitest";
import { formatDayWithDate } from "@/features/events/types";

describe("formatDayWithDate", () => {
	it("formats valid ISO dates with ordinal suffix", () => {
		expect(formatDayWithDate("saturday", "2025-06-21")).toBe("Saturday 21st");
	});

	it("avoids NaN output when date is invalid", () => {
		expect(formatDayWithDate("friday", "")).toBe("Friday");
		expect(formatDayWithDate("friday", "not-a-date")).toBe("Friday");
	});

	it("returns TBC when day is unknown", () => {
		expect(formatDayWithDate("tbc", "2025-06-21")).toBe("TBC");
	});
});
