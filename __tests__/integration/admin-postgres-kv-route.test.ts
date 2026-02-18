import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/admin/postgres/kv/route").GET;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	getAppKVStoreRepository: ReturnType<typeof vi.fn>;
	getRecord: ReturnType<typeof vi.fn>;
	listRecords: ReturnType<typeof vi.fn>;
	countKeys: ReturnType<typeof vi.fn>;
	getEventsStoreStats: ReturnType<typeof vi.fn>;
	getCounts: ReturnType<typeof vi.fn>;
	getMeta: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const getRecord = vi.fn().mockResolvedValue({
		key: "events-store:meta",
		value: "{\"rowCount\":81}",
		updatedAt: "2026-02-18T00:00:00.000Z",
	});
	const listRecords = vi.fn().mockResolvedValue([
		{
			key: "events-store:meta",
			value: "{\"rowCount\":81}",
			updatedAt: "2026-02-18T00:00:00.000Z",
		},
	]);
	const countKeys = vi.fn().mockResolvedValue(1);
	const getEventsStoreStats = vi.fn().mockResolvedValue({
		totalKeys: 1,
		hasMeta: true,
		updatedAt: "2026-02-18T00:00:00.000Z",
	});
	const getAppKVStoreRepository = vi.fn().mockReturnValue({
		getRecord,
		listRecords,
		countKeys,
		getEventsStoreStats,
	});
	const getCounts = vi.fn().mockResolvedValue({ rowCount: 81, columnCount: 14 });
	const getMeta = vi.fn().mockResolvedValue({
		rowCount: 81,
		updatedAt: "2026-02-18T00:00:00.000Z",
		updatedBy: "admin",
		origin: "manual",
		checksum: "abc123",
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/lib/platform/postgres/app-kv-store-repository", () => ({
		getAppKVStoreRepository,
		getAppKVStoreTableName: () => "app_kv_store",
	}));
	vi.doMock("@/lib/platform/postgres/event-sheet-store-repository", () => ({
		getEventSheetStoreRepository: () => ({
			getCounts,
			getMeta,
		}),
	}));

	const route = await import("@/app/api/admin/postgres/kv/route");
	return {
		GET: route.GET,
		validateAdminKeyForApiRoute,
		getAppKVStoreRepository,
		getRecord,
		listRecords,
		countKeys,
		getEventsStoreStats,
		getCounts,
		getMeta,
	};
};

describe("/api/admin/postgres/kv route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when unauthorized", async () => {
		const { GET, validateAdminKeyForApiRoute, listRecords } = await loadRoute();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const response = await GET(
			new NextRequest("https://example.com/api/admin/postgres/kv"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(401);
		expect(payload).toEqual({ success: false, error: "Unauthorized" });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(listRecords).not.toHaveBeenCalled();
	});

	it("returns 503 when Postgres KV repository is unavailable", async () => {
		const { GET, getAppKVStoreRepository } = await loadRoute();
		getAppKVStoreRepository.mockReturnValue(null);

		const response = await GET(
			new NextRequest("https://example.com/api/admin/postgres/kv"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(503);
		expect(payload.success).toBe(false);
		expect(payload.error).toContain("Postgres is not configured");
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("supports key lookup mode and hides values by default", async () => {
		const { GET, getRecord } = await loadRoute();

		const response = await GET(
			new NextRequest(
				"https://example.com/api/admin/postgres/kv?key=events-store%3Ameta",
			),
		);
		const payload = (await response.json()) as {
			success: boolean;
			found: boolean;
			record: { key: string; updatedAt: string };
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.found).toBe(true);
		expect(payload.record).toEqual({
			key: "events-store:meta",
			updatedAt: "2026-02-18T00:00:00.000Z",
		});
		expect(getRecord).toHaveBeenCalledWith("events-store:meta");
	});

	it("supports list mode with clamped limit and metadata-only records", async () => {
		const { GET, listRecords } = await loadRoute();

		const response = await GET(
			new NextRequest(
				"https://example.com/api/admin/postgres/kv?prefix=events&limit=999",
			),
		);
		const payload = (await response.json()) as {
			success: boolean;
			query: { prefix: string; limit: number; includeValues: boolean };
			records: Array<{ key: string; updatedAt: string }>;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.query).toEqual({
			prefix: "events",
			limit: 500,
			includeValues: false,
		});
		expect(payload.records).toEqual([
			{
				key: "events-store:meta",
				updatedAt: "2026-02-18T00:00:00.000Z",
			},
		]);
		expect(listRecords).toHaveBeenCalledWith({ prefix: "events", limit: 500 });
	});

	it("returns 500 when repository calls fail", async () => {
		const { GET, listRecords } = await loadRoute();
		listRecords.mockRejectedValue(new Error("query failed"));

		const response = await GET(
			new NextRequest("https://example.com/api/admin/postgres/kv"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("query failed");
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
