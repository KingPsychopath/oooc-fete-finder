import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/cron/cleanup-admin-sessions/route").GET;
	cleanupExpiredAdminSessions: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();
	const cleanupExpiredAdminSessions = vi.fn().mockResolvedValue(7);

	vi.doMock("@/features/auth/admin-auth-token", () => ({
		cleanupExpiredAdminSessions,
	}));

	const route = await import("@/app/api/cron/cleanup-admin-sessions/route");
	return {
		GET: route.GET,
		cleanupExpiredAdminSessions,
	};
};

describe("/api/cron/cleanup-admin-sessions route", () => {
	const originalCronSecret = process.env.CRON_SECRET;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = "test-cron-secret";
	});

	afterEach(() => {
		process.env.CRON_SECRET = originalCronSecret;
	});

	it("returns 401 for unauthorized requests", async () => {
		const { GET, cleanupExpiredAdminSessions } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/cron/cleanup-admin-sessions"),
		);
		const payload = (await response.json()) as { error: string };

		expect(response.status).toBe(401);
		expect(payload.error).toBe("Unauthorized");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(cleanupExpiredAdminSessions).not.toHaveBeenCalled();
	});

	it("returns deleted count for authorized cron calls", async () => {
		const { GET, cleanupExpiredAdminSessions } = await loadRoute();
		cleanupExpiredAdminSessions.mockResolvedValue(12);

		const response = await GET(
			new NextRequest("https://example.com/api/cron/cleanup-admin-sessions", {
				headers: {
					authorization: "Bearer test-cron-secret",
				},
			}),
		);
		const payload = (await response.json()) as { ok: boolean; deleted: number };

		expect(response.status).toBe(200);
		expect(payload).toEqual({ ok: true, deleted: 12 });
		expect(cleanupExpiredAdminSessions).toHaveBeenCalledTimes(1);
	});

	it("returns 500 when cleanup fails", async () => {
		const { GET, cleanupExpiredAdminSessions } = await loadRoute();
		cleanupExpiredAdminSessions.mockRejectedValue(new Error("cleanup failed"));

		const response = await GET(
			new NextRequest("https://example.com/api/cron/cleanup-admin-sessions", {
				headers: {
					authorization: "Bearer test-cron-secret",
				},
			}),
		);
		const payload = (await response.json()) as { ok: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload).toEqual({ ok: false, error: "cleanup failed" });
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
