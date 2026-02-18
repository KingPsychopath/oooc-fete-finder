import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	saveLocalEventStoreCsv: typeof import("@/features/data-management/actions").saveLocalEventStoreCsv;
	importRemoteCsvToLocalEventStore: typeof import("@/features/data-management/actions").importRemoteCsvToLocalEventStore;
	previewRemoteCsvForAdmin: typeof import("@/features/data-management/actions").previewRemoteCsvForAdmin;
	saveEventSheetEditorRows: typeof import("@/features/data-management/actions").saveEventSheetEditorRows;
	localEventStoreSaveCsv: ReturnType<typeof vi.fn>;
	forceRefreshEventsData: ReturnType<typeof vi.fn>;
	revalidateEventsPaths: ReturnType<typeof vi.fn>;
	processCSVData: ReturnType<typeof vi.fn>;
	pruneStorageToEvents: ReturnType<typeof vi.fn>;
	csvToEditableSheet: ReturnType<typeof vi.fn>;
	fetchRemoteCSV: ReturnType<typeof vi.fn>;
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
	const fetchRemoteCSV = vi.fn().mockResolvedValue({
		content: "Title,Date\nEvent,2026-06-21",
		timestamp: Date.now(),
	});
	const csvToEditableSheet = vi
		.fn()
		.mockReturnValue({ columns: [], rows: [] });
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
		fetchRemoteCSV,
	}));

	vi.doMock("@/features/data-management/csv/sheet-editor", () => ({
		csvToEditableSheet,
		editableSheetToCsv: vi.fn().mockReturnValue("Title,Date\nEvent,2026-06-21"),
		stripLegacyFeaturedColumn: vi.fn((columns, rows) => ({ columns, rows })),
		validateEditableSheet: vi.fn((columns, rows) => ({
			valid: true,
			columns,
			rows,
		})),
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
		previewRemoteCsvForAdmin: actions.previewRemoteCsvForAdmin,
		saveEventSheetEditorRows: actions.saveEventSheetEditorRows,
		localEventStoreSaveCsv,
		forceRefreshEventsData,
		revalidateEventsPaths,
		processCSVData,
		pruneStorageToEvents,
		csvToEditableSheet,
		fetchRemoteCSV,
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

		const result = await saveLocalEventStoreCsv("token", "Title,Date\nEvent,2026-06-21");

		expect(result.success).toBe(true);
		expect(processCSVData).toHaveBeenCalledWith(
			"Title,Date\nEvent,2026-06-21",
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
			[{ key: "title" }] as never[],
			[{ title: "Event" }] as never[],
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

		const result = await saveLocalEventStoreCsv("token", "Title,Date\nEvent,2026-06-21");

		expect(localEventStoreSaveCsv).toHaveBeenCalledTimes(1);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Coordinate population failed");
	});

	it("rejects sheet save when legacy Featured column is present", async () => {
		const { saveEventSheetEditorRows, localEventStoreSaveCsv, processCSVData } =
			await loadActions();

		const result = await saveEventSheetEditorRows(
			"token",
			[
				{ key: "title" },
				{ key: "featured" },
			] as never[],
			[
				{
					title: "Event",
					featured: "Yes",
				},
			] as never[],
			{ revalidateHomepage: false },
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("CSV schema validation failed");
		expect(result.error).toContain("Featured");
		expect(localEventStoreSaveCsv).not.toHaveBeenCalled();
		expect(processCSVData).not.toHaveBeenCalled();
	});

	it("allows remote import when schema has warnings only", async () => {
		const {
			importRemoteCsvToLocalEventStore,
			localEventStoreSaveCsv,
			processCSVData,
			csvToEditableSheet,
		} = await loadActions();
		csvToEditableSheet.mockReturnValueOnce({
			columns: [],
			rows: [{ title: "Event", eventKey: "", date: "21 June" }],
		});

		const result = await importRemoteCsvToLocalEventStore("token");

		expect(result.success).toBe(true);
		expect(localEventStoreSaveCsv).toHaveBeenCalledTimes(1);
		expect(processCSVData).toHaveBeenCalledTimes(1);
	});

	it("surfaces schema warnings in Google preview without blocking import", async () => {
		const { previewRemoteCsvForAdmin, csvToEditableSheet } = await loadActions();
		csvToEditableSheet.mockReturnValueOnce({
			columns: [],
			rows: [{ title: "Event", eventKey: "", date: "21 June" }],
		});

		const result = await previewRemoteCsvForAdmin("token", 5);

		expect(result.success).toBe(true);
		expect(result.canImport).toBe(true);
		expect(result.importBlockedReason).toBeUndefined();
		expect(result.schemaBlockingCount).toBe(0);
		expect(result.schemaWarningCount).toBeGreaterThan(0);
	});
});
