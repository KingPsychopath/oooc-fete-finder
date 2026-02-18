import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	getEventStoreBackupStatus: typeof import("@/features/data-management/actions").getEventStoreBackupStatus;
	createEventStoreBackup: typeof import("@/features/data-management/actions").createEventStoreBackup;
	restoreLatestEventStoreBackup: typeof import("@/features/data-management/actions").restoreLatestEventStoreBackup;
	backupGetStatus: ReturnType<typeof vi.fn>;
	backupCreate: ReturnType<typeof vi.fn>;
	backupRestore: ReturnType<typeof vi.fn>;
	processCSVData: ReturnType<typeof vi.fn>;
	pruneStorageToEvents: ReturnType<typeof vi.fn>;
	forceRefreshEventsData: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const backupGetStatus = vi.fn().mockResolvedValue({
		supported: true,
		status: {
			backupCount: 1,
			latestBackup: {
				id: "bkp_1",
				createdAt: "2026-02-18T10:00:00.000Z",
				createdBy: "admin-panel",
				trigger: "manual",
				rowCount: 50,
				storeUpdatedAt: "2026-02-18T09:00:00.000Z",
				storeChecksum: "abc123",
			},
		},
	});
	const backupCreate = vi.fn().mockResolvedValue({
		success: true,
		message: "Backup created (50 rows)",
		backup: {
			id: "bkp_2",
			createdAt: "2026-02-18T11:00:00.000Z",
			createdBy: "admin-panel",
			trigger: "manual",
			rowCount: 50,
			storeUpdatedAt: "2026-02-18T10:00:00.000Z",
			storeChecksum: "def456",
		},
		prunedCount: 1,
	});
	const backupRestore = vi.fn().mockResolvedValue({
		success: true,
		message: "Restored latest backup",
		restoredFrom: {
			id: "bkp_1",
			createdAt: "2026-02-18T10:00:00.000Z",
			createdBy: "admin-panel",
			trigger: "manual",
			rowCount: 50,
			storeUpdatedAt: "2026-02-18T09:00:00.000Z",
			storeChecksum: "abc123",
		},
		preRestoreBackup: {
			id: "bkp_0",
			createdAt: "2026-02-18T09:59:00.000Z",
			createdBy: "admin-panel-restore",
			trigger: "pre-restore",
			rowCount: 51,
			storeUpdatedAt: "2026-02-18T09:58:00.000Z",
			storeChecksum: "ghi789",
		},
		restoredRowCount: 50,
		restoredCsv: "name,date\nEvent,2026-06-21",
	});

	const processCSVData = vi.fn().mockResolvedValue({
		events: [],
		count: 50,
		source: "store",
		errors: [],
		warnings: [],
		coordinatesPopulated: true,
		coordinatesCount: 50,
	});
	const pruneStorageToEvents = vi.fn().mockResolvedValue({
		beforeCount: 30,
		afterCount: 30,
		removedCount: 0,
	});
	const forceRefreshEventsData = vi.fn().mockResolvedValue({
		success: true,
		message: "ok",
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: vi.fn().mockResolvedValue(true),
	}));

	vi.doMock("@/lib/config/env", () => ({
		env: {
			ADMIN_KEY: "test",
			DATA_MODE: "remote",
			DATABASE_URL: "postgres://test",
			GOOGLE_SERVICE_ACCOUNT_KEY: "",
			REMOTE_CSV_URL: "",
			GOOGLE_SHEET_ID: "",
			NODE_ENV: "test",
			NEXT_PUBLIC_BASE_PATH: "",
			NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
		},
	}));

	vi.doMock("@/features/data-management/runtime-service", () => ({
		getLiveEvents: vi.fn(),
		forceRefreshEventsData,
		fullEventsRevalidation: vi.fn(),
		getRuntimeDataStatusFromSource: vi.fn(),
		revalidateEventsPaths: vi.fn(),
	}));

	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: {
			getStatus: vi.fn(),
			getCsv: vi.fn(),
			saveCsv: vi.fn(),
			clearCsv: vi.fn(),
			getPreview: vi.fn(),
		},
	}));

	vi.doMock("@/features/data-management/event-store-backup-service", () => ({
		EventStoreBackupService: {
			getBackupStatus: backupGetStatus,
			createBackup: backupCreate,
			restoreLatestBackup: backupRestore,
		},
	}));

	vi.doMock("@/features/data-management/data-processor", () => ({
		processCSVData,
	}));

	vi.doMock("@/features/maps/event-coordinate-populator", () => ({
		EventCoordinatePopulator: {
			pruneStorageToEvents,
		},
	}));

	const actions = await import("@/features/data-management/actions");
	return {
		getEventStoreBackupStatus: actions.getEventStoreBackupStatus,
		createEventStoreBackup: actions.createEventStoreBackup,
		restoreLatestEventStoreBackup: actions.restoreLatestEventStoreBackup,
		backupGetStatus,
		backupCreate,
		backupRestore,
		processCSVData,
		pruneStorageToEvents,
		forceRefreshEventsData,
	};
};

describe("data-management backup actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns backup status for admin", async () => {
		const { getEventStoreBackupStatus } = await loadActions();
		const result = await getEventStoreBackupStatus("token");

		expect(result.success).toBe(true);
		expect(result.supported).toBe(true);
		expect(result.status?.latestBackup?.id).toBe("bkp_1");
	});

	it("creates manual backup from admin action", async () => {
		const { createEventStoreBackup, backupCreate } = await loadActions();
		const result = await createEventStoreBackup("token");

		expect(result.success).toBe(true);
		expect(result.message).toContain("Backup created");
		expect(backupCreate).toHaveBeenCalledWith({
			createdBy: "admin-panel",
			trigger: "manual",
		});
	});

	it("fails gracefully when manual backup has no store data", async () => {
		const { createEventStoreBackup, backupCreate } = await loadActions();
		backupCreate.mockResolvedValueOnce({
			success: false,
			message: "Managed store has no rows to back up yet.",
			noData: true,
		});

		const result = await createEventStoreBackup("token");

		expect(result.success).toBe(false);
		expect(result.message).toContain("no rows to back up");
	});

	it("fails restore with clear message when no backup exists", async () => {
		const { restoreLatestEventStoreBackup, backupRestore } = await loadActions();
		backupRestore.mockResolvedValueOnce({
			success: false,
			message: "No event store backup exists yet.",
		});

		const result = await restoreLatestEventStoreBackup("token");

		expect(result.success).toBe(false);
		expect(result.message).toContain("No event store backup exists yet");
	});

	it("restores latest backup, warms coordinates, and revalidates homepage", async () => {
		const {
			restoreLatestEventStoreBackup,
			processCSVData,
			pruneStorageToEvents,
			forceRefreshEventsData,
			backupRestore,
		} = await loadActions();

		const result = await restoreLatestEventStoreBackup("token");

		expect(result.success).toBe(true);
		expect(result.rowCount).toBe(50);
		expect(processCSVData).toHaveBeenCalledWith(
			"name,date\nEvent,2026-06-21",
			"store",
			false,
			{
				populateCoordinates: true,
			},
		);
		expect(pruneStorageToEvents).toHaveBeenCalledTimes(1);
		expect(forceRefreshEventsData).toHaveBeenCalledTimes(1);
		expect(backupRestore).toHaveBeenCalledWith({
			createdBy: "admin-panel-restore",
		});
	});
});
