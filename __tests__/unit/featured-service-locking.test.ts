import { beforeEach, describe, expect, it, vi } from "vitest";

const loadService = async () => {
	vi.resetModules();

	type MockSession = {
		listEntries: ReturnType<typeof vi.fn>;
		createScheduledEntry: ReturnType<typeof vi.fn>;
		rescheduleEntry: ReturnType<typeof vi.fn>;
		cancelEntry: ReturnType<typeof vi.fn>;
		markCompletedEntries: ReturnType<typeof vi.fn>;
		reviveZeroDurationCompletedEntries: ReturnType<typeof vi.fn>;
		updateComputedWindows: ReturnType<typeof vi.fn>;
		clearAllEntries: ReturnType<typeof vi.fn>;
	};

	const session: MockSession = {
		listEntries: vi.fn().mockResolvedValue([]),
		createScheduledEntry: vi.fn().mockResolvedValue({
			id: "entry_1",
			eventKey: "evt_1",
			requestedStartAt: "2026-06-21T10:00:00.000Z",
			effectiveStartAt: "2026-06-21T10:00:00.000Z",
			effectiveEndAt: "2026-06-23T10:00:00.000Z",
			durationHours: 48,
			status: "scheduled",
			createdBy: "test",
			createdAt: "2026-06-21T09:00:00.000Z",
			updatedAt: "2026-06-21T09:00:00.000Z",
		}),
		rescheduleEntry: vi.fn().mockResolvedValue(true),
		cancelEntry: vi.fn().mockResolvedValue(true),
		markCompletedEntries: vi.fn().mockResolvedValue(0),
		reviveZeroDurationCompletedEntries: vi.fn().mockResolvedValue(0),
		updateComputedWindows: vi.fn().mockResolvedValue(undefined),
		clearAllEntries: vi.fn().mockResolvedValue(2),
	};

	const withScheduleLock = vi.fn(
		async (operation: (session: MockSession) => unknown) => operation(session),
	);

	const repository = {
		withScheduleLock,
	};

	vi.doMock("@/lib/platform/postgres/featured-event-repository", () => ({
		getFeaturedEventRepository: vi.fn(() => repository),
	}));

	const service = await import("@/features/events/featured/service");
	return { service, withScheduleLock, session };
};

describe("featured service locking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("runs schedule/cancel/reschedule inside withScheduleLock", async () => {
		const { service, withScheduleLock } = await loadService();

		await service.scheduleFeaturedEntry({ eventKey: "evt_1" });
		await service.cancelFeaturedEntry("entry_1");
		await service.rescheduleFeaturedEntry({
			id: "entry_1",
			requestedStartAt: "2026-06-22T10:00",
		});

		expect(withScheduleLock).toHaveBeenCalledTimes(3);
	});

	it("runs queue recompute/list/clear inside withScheduleLock", async () => {
		const { service, withScheduleLock } = await loadService();

		await service.recomputeFeaturedQueue();
		await service.listFeaturedEntries();
		await service.clearFeaturedQueueHistory();

		expect(withScheduleLock).toHaveBeenCalledTimes(3);
	});
});
