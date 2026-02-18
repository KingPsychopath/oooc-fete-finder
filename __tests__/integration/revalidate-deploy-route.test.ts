import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/revalidate/deploy/route").GET;
	POST: typeof import("@/app/api/revalidate/deploy/route").POST;
	forceRefreshEventsData: ReturnType<typeof vi.fn>;
	logWarn: ReturnType<typeof vi.fn>;
	logError: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();
	const forceRefreshEventsData = vi.fn().mockResolvedValue({
		success: true,
		message: "Loaded events and revalidated homepage",
		count: 81,
		source: "store",
	});
	const logWarn = vi.fn();
	const logError = vi.fn();

	vi.doMock("@/features/data-management/runtime-service", () => ({
		forceRefreshEventsData,
	}));
	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			info: vi.fn(),
			warn: logWarn,
			error: logError,
		},
	}));

	const route = await import("@/app/api/revalidate/deploy/route");
	return {
		GET: route.GET,
		POST: route.POST,
		forceRefreshEventsData,
		logWarn,
		logError,
	};
};

describe("/api/revalidate/deploy route", () => {
	const originalSecret = process.env.DEPLOY_REVALIDATE_SECRET;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.DEPLOY_REVALIDATE_SECRET = "deploy-secret";
	});

	afterEach(() => {
		process.env.DEPLOY_REVALIDATE_SECRET = originalSecret;
	});

	it("returns 503 when deploy secret is not configured", async () => {
		const { GET, forceRefreshEventsData, logWarn } = await loadRoute();
		process.env.DEPLOY_REVALIDATE_SECRET = "";

		const response = await GET(
			new NextRequest("https://example.com/api/revalidate/deploy"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(503);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("DEPLOY_REVALIDATE_SECRET is not configured");
		expect(forceRefreshEventsData).not.toHaveBeenCalled();
		expect(logWarn).toHaveBeenCalledTimes(1);
	});

	it("returns 401 for unauthorized requests", async () => {
		const { GET, forceRefreshEventsData } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/revalidate/deploy", {
				headers: {
					authorization: "Bearer wrong-secret",
				},
			}),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(401);
		expect(payload).toEqual({ success: false, error: "Unauthorized" });
		expect(forceRefreshEventsData).not.toHaveBeenCalled();
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("supports GET with bearer auth", async () => {
		const { GET, forceRefreshEventsData } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/revalidate/deploy", {
				headers: {
					authorization: "Bearer deploy-secret",
				},
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			count: number;
			source: string;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.count).toBe(81);
		expect(payload.source).toBe("store");
		expect(forceRefreshEventsData).toHaveBeenCalledTimes(1);
	});

	it("supports POST with x-revalidate-secret header", async () => {
		const { POST, forceRefreshEventsData } = await loadRoute();

		const response = await POST(
			new NextRequest("https://example.com/api/revalidate/deploy", {
				method: "POST",
				headers: {
					"x-revalidate-secret": "deploy-secret",
				},
			}),
		);
		const payload = (await response.json()) as { success: boolean; message: string };

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.message).toContain("revalidated");
		expect(forceRefreshEventsData).toHaveBeenCalledTimes(1);
	});

	it("returns 500 when live refresh returns failure", async () => {
		const { GET, forceRefreshEventsData, logWarn } = await loadRoute();
		forceRefreshEventsData.mockResolvedValue({
			success: false,
			message: "Homepage revalidation failed",
			error: "store unavailable",
		});

		const response = await GET(
			new NextRequest("https://example.com/api/revalidate/deploy", {
				headers: {
					authorization: "Bearer deploy-secret",
				},
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			message: string;
			error: string;
		};

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.message).toBe("Homepage revalidation failed");
		expect(payload.error).toBe("store unavailable");
		expect(logWarn).toHaveBeenCalledTimes(1);
	});

	it("returns 500 when route throws unexpectedly", async () => {
		const { GET, forceRefreshEventsData, logError } = await loadRoute();
		forceRefreshEventsData.mockRejectedValue(new Error("unexpected refresh error"));

		const response = await GET(
			new NextRequest("https://example.com/api/revalidate/deploy", {
				headers: {
					authorization: "Bearer deploy-secret",
				},
			}),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("unexpected refresh error");
		expect(logError).toHaveBeenCalledTimes(1);
	});
});
