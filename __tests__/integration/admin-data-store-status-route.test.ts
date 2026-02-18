import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/admin/data-store/status/route").GET;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	getStatus: ReturnType<typeof vi.fn>;
	getDataConfigStatus: ReturnType<typeof vi.fn>;
	getRuntimeDataStatusFromSource: ReturnType<typeof vi.fn>;
	getRuntimeMetrics: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const getStatus = vi.fn().mockResolvedValue({
		hasStoreData: true,
		rowCount: 81,
		keyCount: 90,
		updatedAt: "2026-02-18T00:00:00.000Z",
		updatedBy: "admin",
		origin: "manual",
		provider: "postgres",
		providerLocation: "postgres://example",
	});
	const getDataConfigStatus = vi.fn().mockResolvedValue({
		dataSource: "remote",
		remoteConfigured: true,
		hasServiceAccount: true,
		hasLocalStoreData: true,
		storeProvider: "postgres",
		storeProviderLocation: "postgres://example",
		storeRowCount: 81,
		storeUpdatedAt: "2026-02-18T00:00:00.000Z",
		storeKeyCount: 90,
	});
	const getRuntimeDataStatusFromSource = vi.fn().mockResolvedValue({
		dataSource: "store",
		eventCount: 81,
		lastFetchTime: "2026-02-18T00:00:00.000Z",
		lastRemoteErrorMessage: "",
	});
	const getRuntimeMetrics = vi.fn().mockReturnValue({
		totalRequests: 1,
		lastReset: Date.now(),
		errorCount: 0,
		averageFetchTimeMs: 25,
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/features/data-management/local-event-store", () => ({
		LocalEventStore: {
			getStatus,
		},
	}));
	vi.doMock("@/features/data-management/data-manager", () => ({
		DataManager: {
			getDataConfigStatus,
		},
	}));
	vi.doMock("@/features/data-management/runtime-service", () => ({
		getRuntimeDataStatusFromSource,
		getRuntimeMetrics,
	}));

	const route = await import("@/app/api/admin/data-store/status/route");
	return {
		GET: route.GET,
		validateAdminKeyForApiRoute,
		getStatus,
		getDataConfigStatus,
		getRuntimeDataStatusFromSource,
		getRuntimeMetrics,
	};
};

describe("/api/admin/data-store/status route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when admin auth fails", async () => {
		const { GET, validateAdminKeyForApiRoute, getStatus } = await loadRoute();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const response = await GET(
			new NextRequest("https://example.com/api/admin/data-store/status"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(401);
		expect(payload).toEqual({ success: false, error: "Unauthorized" });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(getStatus).not.toHaveBeenCalled();
	});

	it("accepts bearer credential and returns status payload", async () => {
		const { GET, validateAdminKeyForApiRoute } = await loadRoute();
		const request = new NextRequest(
			"https://example.com/api/admin/data-store/status",
			{
				headers: {
					authorization: "Bearer route-admin-token",
				},
			},
		);

		const response = await GET(request);
		const payload = (await response.json()) as {
			success: boolean;
			store: { rowCount: number };
			runtime: { eventCount: number };
			metrics: { totalRequests: number };
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.store.rowCount).toBe(81);
		expect(payload.runtime.eventCount).toBe(81);
		expect(payload.metrics.totalRequests).toBe(1);
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(validateAdminKeyForApiRoute).toHaveBeenCalledWith(
			request,
			"route-admin-token",
		);
	});

	it("returns 500 when a dependency throws", async () => {
		const { GET, getStatus } = await loadRoute();
		getStatus.mockRejectedValue(new Error("status unavailable"));

		const response = await GET(
			new NextRequest("https://example.com/api/admin/data-store/status"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("status unavailable");
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
