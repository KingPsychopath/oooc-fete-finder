import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/admin/deployment-status/route").GET;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/lib/deployment/build-id", () => ({
		getCurrentDeploymentId: () => "deploy-123",
	}));

	const route = await import("@/app/api/admin/deployment-status/route");
	return {
		GET: route.GET,
		validateAdminKeyForApiRoute,
	};
};

describe("/api/admin/deployment-status route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 when unauthorized", async () => {
		const { GET, validateAdminKeyForApiRoute } = await loadRoute();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const response = await GET(
			new NextRequest("https://example.com/api/admin/deployment-status"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			error: string;
		};

		expect(response.status).toBe(401);
		expect(payload).toEqual({ success: false, error: "Unauthorized" });
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("returns the non-secret deployment id for authenticated admins", async () => {
		const { GET } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/admin/deployment-status"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			deploymentId: string;
			timestamp: string;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.deploymentId).toBe("deploy-123");
		expect(payload.timestamp).toBeTruthy();
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
