import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	EventStoreBackupService: typeof import("@/features/data-management/event-store-backup-service").EventStoreBackupService;
	backupRepository: {
		createBackup: ReturnType<typeof vi.fn>;
		getLatestBackup: ReturnType<typeof vi.fn>;
		pruneOldBackups: ReturnType<typeof vi.fn>;
		getBackupStatus: ReturnType<typeof vi.fn>;
	};
	eventStoreRepository: {
		getMeta: ReturnType<typeof vi.fn>;
	};
	localEventStore: {
		getCsv: ReturnType<typeof vi.fn>;
		saveCsv: ReturnType<typeof vi.fn>;
	};
};

const loadService = async (): Promise<Setup> => {
	vi.resetModules();

	const backupRepository = {
		createBackup: vi.fn(),
		getLatestBackup: vi.fn(),
		pruneOldBackups: vi.fn().mockResolvedValue(0),
		getBackupStatus: vi.fn().mockResolvedValue({
			backupCount: 0,
			latestBackup: null,
		}),
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
	const localEventStore = {
		getCsv: vi.fn().mockResolvedValue("name,date\nEvent,2026-06-21"),
		saveCsv: vi.fn().mockResolvedValue({
			rowCount: 50,
			updatedAt: "2026-02-18T12:00:00.000Z",
			updatedBy: "admin-panel-restore",
			origin: "manual",
			checksum: "abc123",
		}),
	};

	vi.doMock("@/lib/platform/postgres/event-store-backup-repository", () => ({
		getEventStoreBackupRepository: () => backupRepository,
	}));
	vi.doMock("@/lib/platform/postgres/event-sheet-store-repository", () => ({
		getEventSheetStoreRepository: () => eventStoreRepository,
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
		expect(backupRepository.createBackup).toHaveBeenCalledTimes(1);
		expect(backupRepository.pruneOldBackups).toHaveBeenCalledWith(30);
		expect(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		).toBeLessThan(backupRepository.pruneOldBackups.mock.invocationCallOrder[0]);
	});

	it("returns no-data response when store csv is empty", async () => {
		const { EventStoreBackupService, localEventStore, backupRepository } =
			await loadService();
		localEventStore.getCsv.mockResolvedValueOnce("");

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
		expect(result.message).toContain("No event store backup exists yet");
	});

	it("creates pre-restore backup before applying restore", async () => {
		const {
			EventStoreBackupService,
			backupRepository,
			localEventStore,
		} = await loadService();

		backupRepository.getLatestBackup.mockResolvedValueOnce({
			id: "bkp_latest",
			createdAt: "2026-02-18T08:00:00.000Z",
			createdBy: "cron",
			trigger: "cron",
			rowCount: 48,
			storeUpdatedAt: "2026-02-18T07:45:00.000Z",
			storeChecksum: "latest123",
			csvContent: "name,date\nRestored Event,2026-06-22",
		});
		backupRepository.createBackup.mockResolvedValueOnce({
			id: "bkp_pre",
			createdAt: "2026-02-18T11:59:00.000Z",
			createdBy: "admin-panel-restore",
			trigger: "pre-restore",
			rowCount: 50,
			storeUpdatedAt: "2026-02-18T11:58:00.000Z",
			storeChecksum: "pre123",
		});
		backupRepository.pruneOldBackups.mockResolvedValueOnce(1);

		const result = await EventStoreBackupService.restoreLatestBackup({
			createdBy: "admin-panel-restore",
		});

		expect(result.success).toBe(true);
		expect(result.preRestoreBackup?.id).toBe("bkp_pre");
		expect(localEventStore.saveCsv).toHaveBeenCalledTimes(1);
		expect(
			backupRepository.createBackup.mock.invocationCallOrder[0],
		).toBeLessThan(localEventStore.saveCsv.mock.invocationCallOrder[0]);
		expect(
			backupRepository.pruneOldBackups.mock.invocationCallOrder[0],
		).toBeGreaterThan(backupRepository.createBackup.mock.invocationCallOrder[0]);
	});
});
