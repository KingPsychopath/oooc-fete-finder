import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/cron/cleanup-rate-limits/route").GET;
	cleanupAuthVerifyRateLimits: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();
	const cleanupAuthVerifyRateLimits = vi.fn().mockResolvedValue(5);

	vi.doMock("@/features/security/rate-limiter", () => ({
		cleanupAuthVerifyRateLimits,
	}));

	const route = await import("@/app/api/cron/cleanup-rate-limits/route");
	return {
		GET: route.GET,
		cleanupAuthVerifyRateLimits,
	};
};

describe("/api/cron/cleanup-rate-limits route", () => {
	const originalCronSecret = process.env.CRON_SECRET;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.CRON_SECRET = "test-cron-secret";
	});

	afterEach(() => {
		process.env.CRON_SECRET = originalCronSecret;
	});

	it("returns 401 for unauthorized requests", async () => {
		const { GET, cleanupAuthVerifyRateLimits } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/cron/cleanup-rate-limits"),
		);
		const payload = (await response.json()) as { error: string };

		expect(response.status).toBe(401);
		expect(payload.error).toBe("Unauthorized");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(cleanupAuthVerifyRateLimits).not.toHaveBeenCalled();
	});

	it("returns deleted count for authorized cron calls", async () => {
		const { GET, cleanupAuthVerifyRateLimits } = await loadRoute();
		cleanupAuthVerifyRateLimits.mockResolvedValue(9);

		const response = await GET(
			new NextRequest("https://example.com/api/cron/cleanup-rate-limits", {
				headers: {
					authorization: "Bearer test-cron-secret",
				},
			}),
		);
		const payload = (await response.json()) as { ok: boolean; deleted: number };

		expect(response.status).toBe(200);
		expect(payload).toEqual({ ok: true, deleted: 9 });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(cleanupAuthVerifyRateLimits).toHaveBeenCalledTimes(1);
	});
});
