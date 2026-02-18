import { describe, expect, it } from "vitest";
import {
	parseParisDateTimeInput,
	toParisDateTimeLocalInput,
} from "@/features/events/featured/paris-time";

describe("parseParisDateTimeInput", () => {
	it("accepts valid datetime-local values in Paris time", () => {
		const parsed = parseParisDateTimeInput("2026-02-18T08:31");
		expect(parsed).toBeInstanceOf(Date);
		expect(parsed?.toISOString()).toBe("2026-02-18T07:31:00.000Z");
	});

	it("round-trips with toParisDateTimeLocalInput", () => {
		const localValue = toParisDateTimeLocalInput(
			new Date("2026-07-15T14:45:00.000Z"),
		);
		const parsed = parseParisDateTimeInput(localValue);
		expect(parsed).toBeInstanceOf(Date);
		expect(toParisDateTimeLocalInput(parsed as Date)).toBe(localValue);
	});
});
