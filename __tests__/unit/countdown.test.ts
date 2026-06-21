import {
	calculateCountdown,
	formatCountdown,
} from "@/features/events/components/Countdown";
import { describe, expect, it } from "vitest";

describe("Countdown", () => {
	it("labels June 21 in Paris as Fete day", () => {
		const countdown = calculateCountdown(new Date("2026-06-21T10:35:00+02:00"));

		expect(countdown.isLiveToday).toBe(true);
		expect(formatCountdown(countdown)).toBe(
			"The city is live, Happy Fete Day!",
		);
	});

	it("uses the Paris calendar day for the live state", () => {
		const countdown = calculateCountdown(new Date("2026-06-20T22:30:00.000Z"));

		expect(countdown.isLiveToday).toBe(true);
		expect(formatCountdown(countdown)).toBe(
			"The city is live, Happy Fete Day!",
		);
	});
});
