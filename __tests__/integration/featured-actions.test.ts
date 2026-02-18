import { beforeEach, describe, expect, it, vi } from "vitest";

const loadActions = async () => {
	vi.resetModules();

	const validateAdminAccess = vi.fn().mockResolvedValue(true);
	const getLiveEvents = vi.fn().mockResolvedValue({
		success: true,
		data: [
			{
				eventKey: "evt_1",
				name: "Event One",
				date: "2026-06-21",
				time: "18:00",
			},
		],
		count: 1,
	});
	const revalidateEventsPaths = vi.fn();
	const scheduleFeaturedEntry = vi.fn().mockResolvedValue({});
	const cancelFeaturedEntry = vi.fn().mockResolvedValue(true);
	const rescheduleFeaturedEntry = vi.fn().mockResolvedValue(true);
	const clearFeaturedQueueHistoryService = vi.fn().mockResolvedValue(3);

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: validateAdminAccess,
	}));

	vi.doMock("@/features/data-management/runtime-service", () => ({
		getLiveEvents,
		revalidateEventsPaths,
	}));

	vi.doMock("@/features/events/featured/service", () => ({
		buildFeaturedQueueItems: vi.fn().mockResolvedValue({
			items: [],
			activeCount: 0,
			slotConfig: {
				maxConcurrent: 3,
				defaultDurationHours: 48,
				timezone: "Europe/Paris",
				recentEndedWindowHours: 48,
			},
		}),
		cancelFeaturedEntry,
		clearFeaturedQueueHistory: clearFeaturedQueueHistoryService,
		formatFeaturedDateTime: vi.fn((value: string) => value),
		getFeatureSlotConfig: vi.fn(() => ({
			maxConcurrent: 3,
			defaultDurationHours: 48,
			timezone: "Europe/Paris",
			recentEndedWindowHours: 48,
		})),
		recomputeFeaturedQueue: vi.fn().mockResolvedValue(undefined),
		rescheduleFeaturedEntry,
		scheduleFeaturedEntry,
	}));

	vi.doMock("@/features/events/featured/paris-time", () => ({
		toParisDateTimeLocalInput: vi.fn(() => "2026-06-21T18:00"),
	}));

	const actions = await import("@/features/events/featured/actions");
	return {
		listFeaturedQueue: actions.listFeaturedQueue,
		scheduleFeaturedEvent: actions.scheduleFeaturedEvent,
		cancelFeaturedSchedule: actions.cancelFeaturedSchedule,
		rescheduleFeaturedEvent: actions.rescheduleFeaturedEvent,
		clearFeaturedQueueHistory: actions.clearFeaturedQueueHistory,
		validateAdminAccess,
		getLiveEvents,
		revalidateEventsPaths,
		scheduleFeaturedEntry,
		cancelFeaturedEntry,
		rescheduleFeaturedEntry,
		clearFeaturedQueueHistoryService,
	};
};

describe("featured actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists queue data for admins", async () => {
		const { listFeaturedQueue, validateAdminAccess, getLiveEvents } =
			await loadActions();
		const result = await listFeaturedQueue();

		expect(result.success).toBe(true);
		expect(validateAdminAccess).toHaveBeenCalledTimes(1);
		expect(getLiveEvents).toHaveBeenCalledTimes(1);
	});

	it("schedules entry and revalidates pages", async () => {
		const {
			scheduleFeaturedEvent,
			scheduleFeaturedEntry,
			revalidateEventsPaths,
		} = await loadActions();
		const result = await scheduleFeaturedEvent("evt_1", "2026-06-21T18:00", 48);

		expect(result.success).toBe(true);
		expect(scheduleFeaturedEntry).toHaveBeenCalledTimes(1);
		expect(revalidateEventsPaths).toHaveBeenCalledWith(["/", "/feature-event"]);
	});

	it("cancels and reschedules entries", async () => {
		const {
			cancelFeaturedSchedule,
			rescheduleFeaturedEvent,
			cancelFeaturedEntry,
			rescheduleFeaturedEntry,
		} = await loadActions();

		const cancelResult = await cancelFeaturedSchedule("entry_1");
		const rescheduleResult = await rescheduleFeaturedEvent(
			"entry_1",
			"2026-06-22T18:00",
			48,
		);

		expect(cancelResult.success).toBe(true);
		expect(rescheduleResult.success).toBe(true);
		expect(cancelFeaturedEntry).toHaveBeenCalledWith("entry_1");
		expect(rescheduleFeaturedEntry).toHaveBeenCalledTimes(1);
	});

	it("clears queue/history and revalidates pages", async () => {
		const {
			clearFeaturedQueueHistory,
			clearFeaturedQueueHistoryService,
			revalidateEventsPaths,
		} = await loadActions();

		const result = await clearFeaturedQueueHistory();

		expect(result.success).toBe(true);
		expect(clearFeaturedQueueHistoryService).toHaveBeenCalledTimes(1);
		expect(revalidateEventsPaths).toHaveBeenCalledWith(["/", "/feature-event"]);
	});

	it("returns unauthorized errors when admin validation fails", async () => {
		const { listFeaturedQueue, scheduleFeaturedEvent, validateAdminAccess } =
			await loadActions();
		validateAdminAccess.mockResolvedValue(false);

		const listResult = await listFeaturedQueue();
		const scheduleResult = await scheduleFeaturedEvent(
			"evt_1",
			"2026-06-21T18:00",
			48,
		);

		expect(listResult.success).toBe(false);
		expect(scheduleResult.success).toBe(false);
		expect(listResult.error).toContain("Unauthorized");
		expect(scheduleResult.error).toContain("Unauthorized");
	});
});
