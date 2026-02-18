import { describe, expect, it } from "vitest";
import { allocateFeaturedQueueWindows } from "@/features/events/featured/scheduler";
import type { FeaturedScheduleEntry } from "@/features/events/featured/types";

const baseEntry = (
	id: string,
	requestedStartAt: string,
	durationHours = 48,
): FeaturedScheduleEntry => ({
	id,
	eventKey: `evt_${id}`,
	requestedStartAt,
	effectiveStartAt: requestedStartAt,
	effectiveEndAt: requestedStartAt,
	durationHours,
	status: "scheduled",
	createdBy: "test",
	createdAt: "2026-02-18T00:00:00.000Z",
	updatedAt: "2026-02-18T00:00:00.000Z",
});

describe("allocateFeaturedQueueWindows", () => {
	it("keeps first three overlapping items at requested start", () => {
		const start = "2026-06-20T10:00:00.000Z";
		const windows = allocateFeaturedQueueWindows(
			[
				baseEntry("a", start),
				baseEntry("b", start),
				baseEntry("c", start),
			],
			{ maxConcurrent: 3 },
		);

		expect(windows).toHaveLength(3);
		expect(new Set(windows.map((window) => window.effectiveStartAt)).size).toBe(1);
		expect(windows[0].effectiveStartAt).toBe(start);
	});

	it("queues the fourth overlapping item after first window ends", () => {
		const start = "2026-06-20T10:00:00.000Z";
		const windows = allocateFeaturedQueueWindows(
			[
				baseEntry("a", start, 48),
				baseEntry("b", start, 48),
				baseEntry("c", start, 48),
				baseEntry("d", start, 48),
			],
			{ maxConcurrent: 3 },
		);

		const fourth = windows.find((window) => window.id === "d");
		expect(fourth).toBeDefined();
		expect(fourth?.effectiveStartAt).toBe("2026-06-22T10:00:00.000Z");
		expect(fourth?.effectiveEndAt).toBe("2026-06-24T10:00:00.000Z");
	});

	it("schedules deterministically by requested start then created metadata", () => {
		const windows = allocateFeaturedQueueWindows(
			[
				{
					...baseEntry("b", "2026-06-20T10:00:00.000Z"),
					createdAt: "2026-06-01T10:00:01.000Z",
				},
				{
					...baseEntry("a", "2026-06-20T10:00:00.000Z"),
					createdAt: "2026-06-01T10:00:00.000Z",
				},
			],
			{ maxConcurrent: 1 },
		);

		expect(windows.map((window) => window.id)).toEqual(["a", "b"]);
		expect(windows[1].effectiveStartAt).toBe("2026-06-22T10:00:00.000Z");
	});
});
