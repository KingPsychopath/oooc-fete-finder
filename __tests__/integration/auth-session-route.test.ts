import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/auth/session/route").GET;
	DELETE: typeof import("@/app/api/auth/session/route").DELETE;
	verifyAdminSessionFromRequest: ReturnType<typeof vi.fn>;
	getUserSessionFromCookieHeader: ReturnType<typeof vi.fn>;
	getUserAuthCookieOptions: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const verifyAdminSessionFromRequest = vi.fn().mockResolvedValue(null);
	const getUserSessionFromCookieHeader = vi
		.fn()
		.mockReturnValue({ isAuthenticated: true, email: "owen@example.com" });
	const getUserAuthCookieOptions = vi.fn().mockReturnValue({
		httpOnly: true,
		secure: false,
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});

	vi.doMock("@/features/auth/admin-auth-token", () => ({
		verifyAdminSessionFromRequest,
	}));

	vi.doMock("@/features/auth/user-session-cookie", () => ({
		USER_AUTH_COOKIE_NAME: "oooc_user_session",
		getUserSessionFromCookieHeader,
		getUserAuthCookieOptions,
	}));

	const route = await import("@/app/api/auth/session/route");
	return {
		GET: route.GET,
		DELETE: route.DELETE,
		verifyAdminSessionFromRequest,
		getUserSessionFromCookieHeader,
		getUserAuthCookieOptions,
	};
};

describe("/api/auth/session route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns fresh auth payload with strict no-store headers", async () => {
		const {
			GET,
			verifyAdminSessionFromRequest,
			getUserSessionFromCookieHeader,
		} = await loadRoute();
		verifyAdminSessionFromRequest.mockResolvedValue({ jti: "session-jti" });

		const request = new NextRequest("https://example.com/api/auth/session", {
			headers: {
				cookie: "oooc_user_session=test-token",
			},
		});

		const response = await GET(request);
		const payload = (await response.json()) as {
			success: boolean;
			isAuthenticated: boolean;
			isAdminAuthenticated: boolean;
			email: string | null;
		};

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			isAuthenticated: true,
			isAdminAuthenticated: true,
			email: "owen@example.com",
		});
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(response.headers.get("pragma")).toBe("no-cache");
		expect(response.headers.get("expires")).toBe("0");
		expect(getUserSessionFromCookieHeader).toHaveBeenCalledWith("test-token");
		expect(verifyAdminSessionFromRequest).toHaveBeenCalledTimes(1);
	});

	it("clears auth cookie on DELETE and keeps response non-cacheable", async () => {
		const { DELETE, getUserAuthCookieOptions } = await loadRoute();

		const response = await DELETE();
		const payload = (await response.json()) as { success: boolean };
		const setCookie = response.headers.get("set-cookie") ?? "";

		expect(response.status).toBe(200);
		expect(payload).toEqual({ success: true });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(setCookie).toContain("oooc_user_session=");
		expect(setCookie).toContain("Path=/");
		expect(setCookie.toLowerCase()).toContain("max-age=0");
		expect(getUserAuthCookieOptions).toHaveBeenCalledTimes(1);
	});
});
