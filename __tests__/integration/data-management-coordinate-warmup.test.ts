import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	saveLocalEventStoreCsv: typeof import("@/features/data-management/actions").saveLocalEventStoreCsv;
	importRemoteCsvToLocalEventStore: typeof import("@/features/data-management/actions").importRemoteCsvToLocalEventStore;
	saveEventSheetEditorRows: typeof import("@/features/data-management/actions").saveEventSheetEditorRows;
	localEventStoreSaveCsv: ReturnType<typeof vi.fn>;
	forceRefreshEventsData: ReturnType<typeof vi.fn>;
	revalidateEventsPaths: ReturnType<typeof vi.fn>;
	processCSVData: ReturnType<typeof vi.fn>;
	pruneStorageToEvents: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const localEventStoreSaveCsv = vi.fn().mockResolvedValue({
		rowCount: 2,
		updatedAt: "2026-02-18T00:00:00.000Z",
	});
	const forceRefreshEventsData = vi.fn().mockResolvedValue({
		success: true,
		message: "ok",
	});
	const revalidateEventsPaths = vi.fn();
	const processCSVData = vi.fn().mockResolvedValue({
		events: [],
		count: 2,
		source: "store",
		errors: [],
		warnings: [],
		coordinatesPopulated: true,
		coordinatesCount: 2,
	});
	const pruneStorageToEvents = vi.fn().mockResolvedValue({
		beforeCount: 10,
		afterCount: 8,
		removedCount: 2,
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: vi.fn().mockResolvedValue(true),
	}));

	vi.doMock("@/lib/config/env", () => ({
		env: {
			ADMIN_KEY: "test",
			DATA_MODE: "remote",
			DATABASE_URL: "postgres://test",
			LOCAL_CSV_LAST_UPDATED: "2026-02-18",
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
		revalidateEventsPaths,
	}));

	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: {
			getStatus: vi.fn(),
			getCsv: vi.fn(),
			saveCsv: localEventStoreSaveCsv,
			clearCsv: vi.fn(),
			getPreview: vi.fn(),
		},
	}));

	vi.doMock("@/features/data-management/csv/fetcher", () => ({
		fetchRemoteCSV: vi.fn().mockResolvedValue({
			content: "name,date\nEvent,2026-06-21",
			timestamp: Date.now(),
		}),
	}));

	vi.doMock("@/features/data-management/csv/sheet-editor", () => ({
		csvToEditableSheet: vi.fn(),
		editableSheetToCsv: vi.fn().mockReturnValue("name,date\nEvent,2026-06-21"),
		validateEditableSheet: vi.fn().mockReturnValue({
			valid: true,
			columns: [{ key: "name" }],
			rows: [{ name: "Event" }],
		}),
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
		saveLocalEventStoreCsv: actions.saveLocalEventStoreCsv,
		importRemoteCsvToLocalEventStore: actions.importRemoteCsvToLocalEventStore,
		saveEventSheetEditorRows: actions.saveEventSheetEditorRows,
		localEventStoreSaveCsv,
		forceRefreshEventsData,
		revalidateEventsPaths,
		processCSVData,
		pruneStorageToEvents,
	};
};

describe("data-management coordinate warm-up", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("warms coordinates after local store save before refresh", async () => {
		const {
			saveLocalEventStoreCsv,
			processCSVData,
			forceRefreshEventsData,
			pruneStorageToEvents,
		} =
			await loadActions();

		const result = await saveLocalEventStoreCsv("token", "name,date\nEvent,2026-06-21");

		expect(result.success).toBe(true);
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
	});

	it("warms coordinates after remote import before refresh", async () => {
		const {
			importRemoteCsvToLocalEventStore,
			processCSVData,
			forceRefreshEventsData,
			pruneStorageToEvents,
		} = await loadActions();

		const result = await importRemoteCsvToLocalEventStore("token");

		expect(result.success).toBe(true);
		expect(processCSVData).toHaveBeenCalledTimes(1);
		expect(pruneStorageToEvents).toHaveBeenCalledTimes(1);
		expect(forceRefreshEventsData).toHaveBeenCalledTimes(1);
	});

	it("skips warm-up when sheet save disables homepage revalidation", async () => {
		const {
			saveEventSheetEditorRows,
			processCSVData,
			revalidateEventsPaths,
			pruneStorageToEvents,
		} = await loadActions();

		const result = await saveEventSheetEditorRows(
			"token",
			[{ key: "name" }] as never[],
			[{ name: "Event" }] as never[],
			{ revalidateHomepage: false },
		);

		expect(result.success).toBe(true);
		expect(processCSVData).not.toHaveBeenCalled();
		expect(pruneStorageToEvents).not.toHaveBeenCalled();
		expect(revalidateEventsPaths).toHaveBeenCalledWith(["/"]);
	});

	it("surfaces warm-up errors while leaving saved store write intact", async () => {
		const { saveLocalEventStoreCsv, processCSVData, localEventStoreSaveCsv } =
			await loadActions();
		processCSVData.mockResolvedValueOnce({
			events: [],
			count: 0,
			source: "store",
			errors: ["Coordinate population failed: geocode timeout"],
			warnings: [],
			coordinatesPopulated: false,
			coordinatesCount: 0,
		});

		const result = await saveLocalEventStoreCsv("token", "name,date\nEvent,2026-06-21");

		expect(localEventStoreSaveCsv).toHaveBeenCalledTimes(1);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Coordinate population failed");
	});
});
