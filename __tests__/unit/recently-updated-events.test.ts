import {
	UPDATED_EVENT_WINDOW_DAYS,
	formatRecentlyUpdatedLabel,
	isRecentlyUpdatedEvent,
} from "@/features/events/recently-updated";
import { describe, expect, it } from "vitest";

describe("recently updated events", () => {
	const now = new Date("2026-05-08T12:00:00.000Z");

	it("uses a three day update window", () => {
		expect(UPDATED_EVENT_WINDOW_DAYS).toBe(3);
		expect(
			isRecentlyUpdatedEvent(
				{
					firstSeenAt: "2026-04-20T12:00:00.000Z",
					lastMeaningfulChangeAt: "2026-05-05T12:00:00.000Z",
				},
				now,
			),
		).toBe(true);
		expect(
			isRecentlyUpdatedEvent(
				{
					firstSeenAt: "2026-04-20T12:00:00.000Z",
					lastMeaningfulChangeAt: "2026-05-05T11:59:59.999Z",
				},
				now,
			),
		).toBe(false);
	});

	it("does not mark initial first-seen metadata as an update", () => {
		expect(
			isRecentlyUpdatedEvent(
				{
					firstSeenAt: "2026-05-07T08:00:00.000Z",
					lastMeaningfulChangeAt: "2026-05-07T08:00:00.000Z",
				},
				now,
			),
		).toBe(false);
	});

	it("ignores events without valid update metadata", () => {
		expect(isRecentlyUpdatedEvent({}, now)).toBe(false);
		expect(
			isRecentlyUpdatedEvent({ lastMeaningfulChangeAt: "not-a-date" }, now),
		).toBe(false);
	});

	it("formats update labels without exposing raw metadata", () => {
		expect(
			formatRecentlyUpdatedLabel(
				{ lastMeaningfulChangeAt: "2026-05-08T08:00:00.000Z" },
				now,
			),
		).toBe("Updated today");
		expect(
			formatRecentlyUpdatedLabel(
				{ lastMeaningfulChangeAt: "2026-05-07T08:00:00.000Z" },
				now,
			),
		).toBe("Updated yesterday");
		expect(
			formatRecentlyUpdatedLabel(
				{ lastMeaningfulChangeAt: "2026-05-05T08:00:00.000Z" },
				now,
			),
		).toBe("Updated 3 days ago");
	});
});
