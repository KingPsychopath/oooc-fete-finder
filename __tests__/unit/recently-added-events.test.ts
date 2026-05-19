import {
	NEW_EVENT_WINDOW_DAYS,
	formatRecentlyAddedLabel,
	isRecentlyAddedEvent,
} from "@/features/events/recently-added";
import { describe, expect, it } from "vitest";

describe("recently added events", () => {
	const now = new Date("2026-05-08T12:00:00.000Z");

	it("uses a three day new event window", () => {
		expect(NEW_EVENT_WINDOW_DAYS).toBe(3);
		expect(
			isRecentlyAddedEvent({ firstSeenAt: "2026-05-05T12:00:00.000Z" }, now),
		).toBe(true);
		expect(
			isRecentlyAddedEvent({ firstSeenAt: "2026-05-05T11:59:59.999Z" }, now),
		).toBe(false);
	});

	it("ignores events without valid first seen metadata", () => {
		expect(isRecentlyAddedEvent({}, now)).toBe(false);
		expect(isRecentlyAddedEvent({ firstSeenAt: "not-a-date" }, now)).toBe(
			false,
		);
	});

	it("formats modal labels without exposing raw metadata", () => {
		expect(
			formatRecentlyAddedLabel(
				{ firstSeenAt: "2026-05-08T08:00:00.000Z" },
				now,
			),
		).toBe("Added today");
		expect(
			formatRecentlyAddedLabel(
				{ firstSeenAt: "2026-05-07T08:00:00.000Z" },
				now,
			),
		).toBe("Added yesterday");
		expect(
			formatRecentlyAddedLabel(
				{ firstSeenAt: "2026-05-05T08:00:00.000Z" },
				now,
			),
		).toBe("Added 3 days ago");
	});
});
