import type { DataManager as DataManagerClass } from "@/features/data-management/data-manager";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	DataManager: typeof DataManagerClass;
	localEventStore: {
		getCsv: ReturnType<typeof vi.fn>;
		getStatus: ReturnType<typeof vi.fn>;
	};
	processCSVData: ReturnType<typeof vi.fn>;
	isValidEventsData: ReturnType<typeof vi.fn>;
	fetchLocalCSV: ReturnType<typeof vi.fn>;
	backupRepository: {
		getLatestBackup: ReturnType<typeof vi.fn>;
	};
};

const loadDataManager = async (
	mode: "remote" | "local" | "test" = "remote",
): Promise<Setup> => {
	vi.resetModules();

	const localEventStore = {
		getCsv: vi.fn(),
		getStatus: vi.fn().mockResolvedValue({
			hasStoreData: true,
			rowCount: 1,
			keyCount: 1,
			updatedAt: null,
			updatedBy: null,
			origin: null,
			provider: "postgres",
			providerLocation: "db",
		}),
	};
	const processCSVData = vi.fn();
	const isValidEventsData = vi.fn((events: unknown[]) => events.length > 0);
	const fetchLocalCSV = vi.fn();
	const backupRepository = {
		getLatestBackup: vi.fn().mockResolvedValue(null),
	};

	vi.doMock("@/lib/config/env", () => ({
		env: {
			DATA_MODE: mode,
			DATABASE_URL: "postgres://test",
		},
	}));

	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: localEventStore,
	}));

	vi.doMock("@/features/data-management/data-processor", () => ({
		processCSVData,
		isValidEventsData,
	}));

	vi.doMock("@/features/data-management/csv/fetcher", () => ({
		fetchLocalCSV,
	}));

	vi.doMock("@/lib/platform/postgres/event-store-backup-repository", () => ({
		getEventStoreBackupRepository: () => backupRepository,
	}));

	const { DataManager } = await import(
		"@/features/data-management/data-manager"
	);

	return {
		DataManager,
		localEventStore,
		processCSVData,
		isValidEventsData,
		fetchLocalCSV,
		backupRepository,
	};
};

describe("DataManager source orchestration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses Postgres store first in remote mode when valid", async () => {
		const { DataManager, localEventStore, processCSVData, fetchLocalCSV } =
			await loadDataManager("remote");

		localEventStore.getCsv.mockResolvedValue("store-csv");
		processCSVData.mockResolvedValue({
			events: [{ id: "1", name: "Store Event", date: "2025-06-21" }],
			count: 1,
			source: "store",
			errors: [],
			warnings: [],
		});

		const result = await DataManager.getEventsData();

		expect(result.success).toBe(true);
		expect(result.source).toBe("store");
		expect(fetchLocalCSV).not.toHaveBeenCalled();
	});

	it("passes custom genre taxonomy into the live store parser", async () => {
		const { DataManager, localEventStore, processCSVData } =
			await loadDataManager("remote");
		const genreTaxonomy = {
			genres: [
				{
					key: "latino",
					label: "Latino",
					color: "bg-blue-600",
					isActive: true,
				},
			],
			aliases: [],
		};

		localEventStore.getCsv.mockResolvedValue("store-csv");
		processCSVData.mockResolvedValue({
			events: [{ id: "1", name: "Store Event", date: "2025-06-21" }],
			count: 1,
			source: "store",
			errors: [],
			warnings: [],
		});

		await DataManager.getEventsData({ genreTaxonomy });

		expect(processCSVData).toHaveBeenCalledWith(
			"store-csv",
			"store",
			false,
			expect.objectContaining({ genreTaxonomy }),
		);
	});

	it("falls back to local CSV when store is empty", async () => {
		const {
			DataManager,
			localEventStore,
			processCSVData,
			fetchLocalCSV,
			backupRepository,
		} = await loadDataManager("remote");

		localEventStore.getCsv.mockResolvedValue(null);
		backupRepository.getLatestBackup.mockResolvedValue(null);
		fetchLocalCSV.mockResolvedValue("local-csv");
		processCSVData.mockResolvedValue({
			events: [{ id: "2", name: "Fallback Event", date: "2025-06-21" }],
			count: 1,
			source: "local",
			errors: [],
			warnings: [],
		});

		const result = await DataManager.getEventsData();

		expect(result.success).toBe(true);
		expect(result.source).toBe("local");
		expect(result.warnings.join(" | ")).toContain(
			"Managed store unavailable or empty",
		);
	});

	it("falls back to the latest backup before local CSV", async () => {
		const {
			DataManager,
			localEventStore,
			processCSVData,
			fetchLocalCSV,
			backupRepository,
		} = await loadDataManager("remote");

		localEventStore.getCsv.mockResolvedValue(null);
		backupRepository.getLatestBackup.mockResolvedValue({
			id: "backup-1",
			createdAt: "2026-04-29T10:00:00.000Z",
			rowCount: 1,
			csvContent: "backup-csv",
		});
		processCSVData.mockResolvedValue({
			events: [
				{ id: "backup-event", name: "Backup Event", date: "2026-06-21" },
			],
			count: 1,
			source: "backup",
			errors: [],
			warnings: [],
		});

		const result = await DataManager.getEventsData();

		expect(result.success).toBe(true);
		expect(result.source).toBe("backup");
		expect(fetchLocalCSV).not.toHaveBeenCalled();
		expect(processCSVData).toHaveBeenCalledWith(
			"backup-csv",
			"backup",
			false,
			expect.objectContaining({ populateCoordinates: false }),
		);
		expect(result.warnings.join(" | ")).toContain(
			"Managed store unavailable; serving latest event store backup.",
		);
	});

	it("falls back to local CSV when store data is invalid", async () => {
		const {
			DataManager,
			localEventStore,
			processCSVData,
			isValidEventsData,
			fetchLocalCSV,
		} = await loadDataManager("remote");

		localEventStore.getCsv.mockResolvedValue("store-csv");
		fetchLocalCSV.mockResolvedValue("local-csv");
		processCSVData
			.mockResolvedValueOnce({
				events: [{ id: "bad", name: "", date: "" }],
				count: 1,
				source: "store",
				errors: ["bad store row"],
				warnings: [],
			})
			.mockResolvedValueOnce({
				events: [{ id: "3", name: "Local Event", date: "2025-06-21" }],
				count: 1,
				source: "local",
				errors: [],
				warnings: [],
			});
		isValidEventsData.mockReturnValueOnce(false).mockReturnValueOnce(true);

		const result = await DataManager.getEventsData();

		expect(result.success).toBe(true);
		expect(result.source).toBe("local");
		expect(processCSVData).toHaveBeenCalledTimes(2);
	});

	it("returns failure when both store and local fallback fail", async () => {
		const { DataManager, localEventStore, fetchLocalCSV } =
			await loadDataManager("remote");

		localEventStore.getCsv.mockRejectedValue(new Error("store unavailable"));
		fetchLocalCSV.mockRejectedValue(new Error("local missing"));

		const result = await DataManager.getEventsData();

		expect(result.success).toBe(false);
		expect(result.source).toBe("local");
		expect(result.error).toContain("store unavailable");
		expect(result.warnings.join(" | ")).toContain("Local CSV fallback failed");
	});
});
