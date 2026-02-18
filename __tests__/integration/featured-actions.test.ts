import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	listFeaturedQueue: typeof import("@/features/events/featured/actions").listFeaturedQueue;
	scheduleFeaturedEvent: typeof import("@/features/events/featured/actions").scheduleFeaturedEvent;
	cancelFeaturedSchedule: typeof import("@/features/events/featured/actions").cancelFeaturedSchedule;
	rescheduleFeaturedEvent: typeof import("@/features/events/featured/actions").rescheduleFeaturedEvent;
	validateAdminAccess: ReturnType<typeof vi.fn>;
	getLiveEvents: ReturnType<typeof vi.fn>;
	revalidateEventsPaths: ReturnType<typeof vi.fn>;
	scheduleFeaturedEntry: ReturnType<typeof vi.fn>;
	cancelFeaturedEntry: ReturnType<typeof vi.fn>;
	rescheduleFeaturedEntry: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
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
		validateAdminAccess,
		getLiveEvents,
		revalidateEventsPaths,
		scheduleFeaturedEntry,
		cancelFeaturedEntry,
		rescheduleFeaturedEntry,
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
		const { scheduleFeaturedEvent, scheduleFeaturedEntry, revalidateEventsPaths } =
			await loadActions();
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
