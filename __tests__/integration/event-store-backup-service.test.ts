import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeaturedScheduleEntry } from "@/features/events/featured/types";

const sampleFeaturedEntry = (overrides?: Partial<FeaturedScheduleEntry>): FeaturedScheduleEntry => ({
	id: "f_1",
	eventKey: "evt_1",
	requestedStartAt: "2026-06-21T10:00:00.000Z",
	effectiveStartAt: "2026-06-21T10:00:00.000Z",
	effectiveEndAt: "2026-06-23T10:00:00.000Z",
	durationHours: 48,
	status: "scheduled",
	createdBy: "admin",
	createdAt: "2026-02-18T09:00:00.000Z",
	updatedAt: "2026-02-18T09:00:00.000Z",
	...overrides,
});

type Setup = {
	EventStoreBackupService: typeof import("@/features/data-management/event-store-backup-service").EventStoreBackupService;
	backupRepository: {
		createBackup: ReturnType<typeof vi.fn>;
		getLatestBackup: ReturnType<typeof vi.fn>;
		getBackupById: ReturnType<typeof vi.fn>;
		pruneOldBackups: ReturnType<typeof vi.fn>;
		getBackupStatus: ReturnType<typeof vi.fn>;
		listBackups: ReturnType<typeof vi.fn>;
	};
	eventStoreRepository: {
		getMeta: ReturnType<typeof vi.fn>;
	};
	featuredRepository: {
		withScheduleLock: ReturnType<typeof vi.fn>;
		session: {
			listEntries: ReturnType<typeof vi.fn>;
			replaceAllEntries: ReturnType<typeof vi.fn>;
		};
	};
	localEventStore: {
		getCsv: ReturnType<typeof vi.fn>;
		saveCsv: ReturnType<typeof vi.fn>;
		clearCsv: ReturnType<typeof vi.fn>;
	};
};

const loadService = async (): Promise<Setup> => {
	vi.resetModules();

	const backupRepository = {
		createBackup: vi.fn(),
		getLatestBackup: vi.fn(),
		getBackupById: vi.fn(),
		pruneOldBackups: vi.fn().mockResolvedValue(0),
		getBackupStatus: vi.fn().mockResolvedValue({
			backupCount: 0,
			latestBackup: null,
		}),
		listBackups: vi.fn().mockResolvedValue([]),
	};
	const eventStoreRepository = {
		getMeta: vi.fn().mockResolvedValue({
			rowCount: 50,
			updatedAt: "2026-02-18T09:00:00.000Z",
			updatedBy: "admin-panel",
			origin: "manual",
			checksum: "abc123",
		}),
	};
	const session = {
		listEntries: vi.fn().mockResolvedValue([sampleFeaturedEntry()]),
		replaceAllEntries: vi.fn().mockResolvedValue(undefined),
	};
	const featuredRepository = {
		session,
		withScheduleLock: vi.fn(async (operation: (sessionArg: typeof session) => unknown) =>
			operation(session),
		),
	};
	const localEventStore = {
		getCsv: vi.fn().mockResolvedValue("name,date\nEvent,2026-06-21"),
		saveCsv: vi.fn().mockResolvedValue({
			rowCount: 50,
			updatedAt: "2026-02-18T12:00:00.000Z",
			updatedBy: "admin-panel-restore",
			origin: "manual",
			checksum: "abc123",
		}),
		clearCsv: vi.fn().mockResolvedValue(undefined),
	};

	vi.doMock("@/lib/platform/postgres/event-store-backup-repository", () => ({
		getEventStoreBackupRepository: () => backupRepository,
	}));
	vi.doMock("@/lib/platform/postgres/event-sheet-store-repository", () => ({
		getEventSheetStoreRepository: () => eventStoreRepository,
	}));
	vi.doMock("@/lib/platform/postgres/featured-event-repository", () => ({
		getFeaturedEventRepository: () => featuredRepository,
	}));
	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: localEventStore,
	}));

	const { EventStoreBackupService } = await import(
		"@/features/data-management/event-store-backup-service"
	);

	return {
		EventStoreBackupService,
		backupRepository,
		eventStoreRepository,
		featuredRepository,
		localEventStore,
	};
};

describe("EventStoreBackupService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates backup and prunes old snapshots", async () => {
		const { EventStoreBackupService, backupRepository } = await loadService();
		backupRepository.createBackup.mockResolvedValue({
			id: "bkp_1",
			createdAt: "2026-02-18T10:00:00.000Z",
			createdBy: "admin-panel",
			trigger: "manual",
			rowCount: 50,
			featuredEntryCount: 1,
			storeUpdatedAt: "2026-02-18T09:00:00.000Z",
			storeChecksum: "abc123",
		});
		backupRepository.pruneOldBackups.mockResolvedValueOnce(3);

		const result = await EventStoreBackupService.createBackup({
			createdBy: "admin-panel",
			trigger: "manual",
		});

		expect(result.success).toBe(true);
		expect(result.prunedCount).toBe(3);
		expect(result.message).toContain("1 featured entries");
		expect(backupRepository.createBackup).toHaveBeenCalledWith(
			expect.objectContaining({
				featuredEntryCount: 1,
			}),
		);
		expect(backupRepository.pruneOldBackups).toHaveBeenCalledWith(30);
		expect(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		).toBeLessThan(backupRepository.pruneOldBackups.mock.invocationCallOrder[0]);
	});

	it("returns no-data response when store csv and featured schedule are empty", async () => {
		const {
			EventStoreBackupService,
			localEventStore,
			featuredRepository,
			backupRepository,
		} = await loadService();
		localEventStore.getCsv.mockResolvedValueOnce("");
		featuredRepository.session.listEntries.mockResolvedValueOnce([]);

		const result = await EventStoreBackupService.createBackup({
			createdBy: "admin-panel",
			trigger: "manual",
		});

		expect(result.success).toBe(false);
		expect(result.noData).toBe(true);
		expect(backupRepository.createBackup).not.toHaveBeenCalled();
	});

	it("returns clear error when latest backup is missing", async () => {
		const { EventStoreBackupService, backupRepository } = await loadService();
		backupRepository.getLatestBackup.mockResolvedValueOnce(null);

		const result = await EventStoreBackupService.restoreLatestBackup({
			createdBy: "admin-panel-restore",
		});

		expect(result.success).toBe(false);
		expect(result.message).toContain("No matching event store backup exists");
	});

	it("creates pre-restore backup and restores selected snapshot payload", async () => {
		const {
			EventStoreBackupService,
			backupRepository,
			localEventStore,
			featuredRepository,
		} = await loadService();

		backupRepository.getBackupById.mockResolvedValueOnce({
			id: "bkp_target",
			createdAt: "2026-02-18T08:00:00.000Z",
			createdBy: "cron",
			trigger: "cron",
			rowCount: 48,
			featuredEntryCount: 1,
			storeUpdatedAt: "2026-02-18T07:45:00.000Z",
			storeChecksum: "latest123",
			csvContent: "name,date\nRestored Event,2026-06-22",
			featuredEntriesJson: JSON.stringify([
				sampleFeaturedEntry({
					id: "f_target",
					eventKey: "evt_target",
				}),
			]),
		});
		backupRepository.createBackup.mockResolvedValueOnce({
			id: "bkp_pre",
			createdAt: "2026-02-18T11:59:00.000Z",
			createdBy: "admin-panel-restore",
			trigger: "pre-restore",
			rowCount: 50,
			featuredEntryCount: 1,
			storeUpdatedAt: "2026-02-18T11:58:00.000Z",
			storeChecksum: "pre123",
		});
		backupRepository.pruneOldBackups.mockResolvedValueOnce(1);

		const result = await EventStoreBackupService.restoreBackup({
			createdBy: "admin-panel-restore",
			backupId: "bkp_target",
		});

		expect(result.success).toBe(true);
		expect(result.preRestoreBackup?.id).toBe("bkp_pre");
		expect(localEventStore.saveCsv).toHaveBeenCalledTimes(1);
		expect(featuredRepository.session.replaceAllEntries).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ id: "f_target", eventKey: "evt_target" }),
			]),
		);
		expect(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		).toBeLessThan(localEventStore.saveCsv.mock.invocationCallOrder[0]);
		expect(
			backupRepository.pruneOldBackups.mock.invocationCallOrder[0],
		).toBeGreaterThan(backupRepository.createBackup.mock.invocationCallOrder[0]);
	});
});
