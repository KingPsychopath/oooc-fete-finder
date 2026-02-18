import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/admin/health/route").GET;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	getStatus: ReturnType<typeof vi.fn>;
	getCsv: ReturnType<typeof vi.fn>;
	getDataConfigStatus: ReturnType<typeof vi.fn>;
	getRuntimeDataStatusFromSource: ReturnType<typeof vi.fn>;
	processCSVData: ReturnType<typeof vi.fn>;
	getAppKVStoreRepository: ReturnType<typeof vi.fn>;
	isPostgresConfigured: ReturnType<typeof vi.fn>;
	getCounts: ReturnType<typeof vi.fn>;
	getMeta: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const getStatus = vi.fn().mockResolvedValue({
		hasStoreData: true,
		rowCount: 3,
		keyCount: 20,
		updatedAt: "2026-02-18T00:00:00.000Z",
		updatedBy: "admin",
		origin: "manual",
		provider: "postgres",
		providerLocation: "postgres://example",
	});
	const getCsv = vi.fn().mockResolvedValue("Name,Date\nA,2026-01-01\nB,2026-01-02");
	const getDataConfigStatus = vi.fn().mockResolvedValue({
		dataSource: "remote",
		remoteConfigured: true,
	});
	const getRuntimeDataStatusFromSource = vi.fn().mockResolvedValue({
		dataSource: "local",
		eventCount: 4,
		lastFetchTime: "2026-02-18T00:00:00.000Z",
		lastRemoteErrorMessage: "fallback active",
	});
	const processCSVData = vi.fn().mockResolvedValue({
		count: 1,
		errors: ["missing column"],
	});
	const getAppKVStoreRepository = vi.fn().mockReturnValue({});
	const getAppKVStoreTableName = vi.fn().mockReturnValue("app_kv_store");
	const isPostgresConfigured = vi.fn().mockReturnValue(true);
	const getCounts = vi.fn().mockResolvedValue({ rowCount: 5, columnCount: 14 });
	const getMeta = vi.fn().mockResolvedValue({
		rowCount: 6,
		updatedAt: "2026-02-18T00:00:00.000Z",
		updatedBy: "admin",
		origin: "manual",
		checksum: "abc123",
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: {
			getStatus,
			getCsv,
		},
	}));
	vi.doMock("@/features/data-management/data-manager", () => ({
		DataManager: {
			getDataConfigStatus,
		},
	}));
	vi.doMock("@/features/data-management/runtime-service", () => ({
		getRuntimeDataStatusFromSource,
	}));
	vi.doMock("@/features/data-management/data-processor", () => ({
		processCSVData,
	}));
	vi.doMock("@/lib/platform/postgres/app-kv-store-repository", () => ({
		getAppKVStoreRepository,
		getAppKVStoreTableName,
	}));
	vi.doMock("@/lib/platform/postgres/event-sheet-store-repository", () => ({
		getEventSheetStoreRepository: () => ({
			getCounts,
			getMeta,
		}),
	}));
	vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
		isPostgresConfigured,
	}));

	const route = await import("@/app/api/admin/health/route");
	return {
		GET: route.GET,
		validateAdminKeyForApiRoute,
		getStatus,
		getCsv,
		getDataConfigStatus,
		getRuntimeDataStatusFromSource,
		processCSVData,
		getAppKVStoreRepository,
		isPostgresConfigured,
		getCounts,
		getMeta,
	};
};

describe("/api/admin/health route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when unauthorized", async () => {
		const { GET, validateAdminKeyForApiRoute, getStatus } = await loadRoute();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const response = await GET(
			new NextRequest("https://example.com/api/admin/health"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(401);
		expect(payload).toEqual({ success: false, error: "Unauthorized" });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(getStatus).not.toHaveBeenCalled();
	});

	it("returns health payload with mismatch diagnostics", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/admin/health"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			counts: {
				csvRawRows: number;
				parsedEvents: number;
				liveRuntimeEvents: number;
			};
			warnings: {
				parsingWarnings: string[];
				countMismatches: string[];
			};
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.counts.csvRawRows).toBe(2);
		expect(payload.counts.parsedEvents).toBe(1);
		expect(payload.counts.liveRuntimeEvents).toBe(4);
		expect(payload.warnings.parsingWarnings).toEqual(["missing column"]);
		expect(payload.warnings.countMismatches).toHaveLength(4);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("skips CSV parsing when no store CSV exists", async () => {
		const { GET, getCsv, processCSVData } = await loadRoute();
		getCsv.mockResolvedValue(null);

		const response = await GET(
			new NextRequest("https://example.com/api/admin/health"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			warnings: { parsingWarnings: string[] };
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.warnings.parsingWarnings).toEqual([]);
		expect(processCSVData).not.toHaveBeenCalled();
	});

	it("returns 500 when a dependency throws", async () => {
		const { GET, getDataConfigStatus } = await loadRoute();
		getDataConfigStatus.mockRejectedValue(new Error("config unavailable"));

		const response = await GET(
			new NextRequest("https://example.com/api/admin/health"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("config unavailable");
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
