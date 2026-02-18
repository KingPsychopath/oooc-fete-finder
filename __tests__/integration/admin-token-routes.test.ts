import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	getSessions: typeof import("@/app/api/admin/tokens/sessions/route").GET;
	deleteSession: typeof import("@/app/api/admin/tokens/sessions/[jti]/route").DELETE;
	revokeAll: typeof import("@/app/api/admin/tokens/revoke/route").POST;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	listAdminTokenSessions: ReturnType<typeof vi.fn>;
	getCurrentTokenVersion: ReturnType<typeof vi.fn>;
	revokeAdminSessionByJti: ReturnType<typeof vi.fn>;
	revokeAllAdminSessions: ReturnType<typeof vi.fn>;
};

const loadRoutes = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const listAdminTokenSessions = vi.fn().mockResolvedValue([
		{
			jti: "11111111-1111-1111-1111-111111111111",
			tv: 2,
			iat: 1_700_000_000,
			exp: 1_700_003_600,
			ip: "203.0.113.1",
			ua: "Mozilla",
			status: "active",
		},
	]);
	const getCurrentTokenVersion = vi.fn().mockResolvedValue(2);
	const revokeAdminSessionByJti = vi.fn().mockResolvedValue(true);
	const revokeAllAdminSessions = vi.fn().mockResolvedValue(3);

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/features/auth/admin-auth-token", () => ({
		listAdminTokenSessions,
		getCurrentTokenVersion,
		revokeAdminSessionByJti,
		revokeAllAdminSessions,
	}));

	const sessionsRoute = await import("@/app/api/admin/tokens/sessions/route");
	const singleRoute = await import(
		"@/app/api/admin/tokens/sessions/[jti]/route"
	);
	const revokeRoute = await import("@/app/api/admin/tokens/revoke/route");

	return {
		getSessions: sessionsRoute.GET,
		deleteSession: singleRoute.DELETE,
		revokeAll: revokeRoute.POST,
		validateAdminKeyForApiRoute,
		listAdminTokenSessions,
		getCurrentTokenVersion,
		revokeAdminSessionByJti,
		revokeAllAdminSessions,
	};
};

describe("admin token API routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns sessions payload for authorized requests", async () => {
		const { getSessions } = await loadRoutes();

		const response = await getSessions(
			new NextRequest("https://example.com/api/admin/tokens/sessions"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			count: number;
			currentTokenVersion: number;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.count).toBe(1);
		expect(payload.currentTokenVersion).toBe(2);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("returns 500 when sessions listing fails", async () => {
		const { getSessions, listAdminTokenSessions } = await loadRoutes();
		listAdminTokenSessions.mockRejectedValue(new Error("session read failed"));

		const response = await getSessions(
			new NextRequest("https://example.com/api/admin/tokens/sessions"),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("session read failed");
	});

	it("returns 401 for unauthorized token route calls", async () => {
		const {
			getSessions,
			deleteSession,
			revokeAll,
			validateAdminKeyForApiRoute,
		} = await loadRoutes();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const [sessionsResponse, deleteResponse, revokeResponse] = await Promise.all([
			getSessions(new NextRequest("https://example.com/api/admin/tokens/sessions")),
			deleteSession(
				new NextRequest(
					"https://example.com/api/admin/tokens/sessions/abc",
				),
				{ params: Promise.resolve({ jti: "abc" }) },
			),
			revokeAll(new NextRequest("https://example.com/api/admin/tokens/revoke")),
		]);

		expect(sessionsResponse.status).toBe(401);
		expect(deleteResponse.status).toBe(401);
		expect(revokeResponse.status).toBe(401);
	});

	it("decodes jti and revokes a specific session", async () => {
		const { deleteSession, revokeAdminSessionByJti } = await loadRoutes();

		const response = await deleteSession(
			new NextRequest(
				"https://example.com/api/admin/tokens/sessions/111%20aaa%20",
			),
			{
				params: Promise.resolve({
					jti: "111%20aaa%20",
				}),
			},
		);
		const payload = (await response.json()) as { success: boolean; jti: string };

		expect(response.status).toBe(200);
		expect(payload).toEqual({ success: true, jti: "111 aaa" });
		expect(revokeAdminSessionByJti).toHaveBeenCalledWith("111 aaa");
	});

	it("returns 404 when specific session cannot be revoked", async () => {
		const { deleteSession, revokeAdminSessionByJti } = await loadRoutes();
		revokeAdminSessionByJti.mockResolvedValue(false);

		const response = await deleteSession(
			new NextRequest("https://example.com/api/admin/tokens/sessions/missing"),
			{
				params: Promise.resolve({
					jti: "missing",
				}),
			},
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(404);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("Session not found or invalid jti");
	});

	it("revokes all sessions and returns new token version", async () => {
		const { revokeAll } = await loadRoutes();

		const response = await revokeAll(
			new NextRequest("https://example.com/api/admin/tokens/revoke", {
				method: "POST",
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			nextTokenVersion: number;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.nextTokenVersion).toBe(3);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("returns 500 when revoke-all throws", async () => {
		const { revokeAll, revokeAllAdminSessions } = await loadRoutes();
		revokeAllAdminSessions.mockRejectedValue(new Error("revoke failed"));

		const response = await revokeAll(
			new NextRequest("https://example.com/api/admin/tokens/revoke", {
				method: "POST",
			}),
		);
		const payload = (await response.json()) as { success: boolean; error: string };

		expect(response.status).toBe(500);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("revoke failed");
	});
});
