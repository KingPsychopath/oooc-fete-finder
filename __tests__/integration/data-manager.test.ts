import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	DataManager: typeof import("@/features/data-management/data-manager").DataManager;
	localEventStore: {
		getCsv: ReturnType<typeof vi.fn>;
		getStatus: ReturnType<typeof vi.fn>;
	};
	processCSVData: ReturnType<typeof vi.fn>;
	isValidEventsData: ReturnType<typeof vi.fn>;
	fetchLocalCSV: ReturnType<typeof vi.fn>;
};

const loadDataManager = async (mode: "remote" | "local" | "test" = "remote"): Promise<
	Setup
> => {
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

	vi.doMock("@/lib/config/env", () => ({
		env: {
			DATA_MODE: mode,
			DATABASE_URL: "postgres://test",
			LOCAL_CSV_LAST_UPDATED: "2026-02-17",
			GOOGLE_SERVICE_ACCOUNT_KEY: "",
			GOOGLE_SERVICE_ACCOUNT_FILE: "",
			REMOTE_CSV_URL: "",
			GOOGLE_SHEET_ID: "",
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

	const { DataManager } = await import("@/features/data-management/data-manager");

	return {
		DataManager,
		localEventStore,
		processCSVData,
		isValidEventsData,
		fetchLocalCSV,
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

	it("falls back to local CSV when store is empty", async () => {
		const { DataManager, localEventStore, processCSVData, fetchLocalCSV } =
			await loadDataManager("remote");

		localEventStore.getCsv.mockResolvedValue(null);
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
