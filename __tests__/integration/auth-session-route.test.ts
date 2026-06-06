import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/auth/session/route").GET;
	DELETE: typeof import("@/app/api/auth/session/route").DELETE;
	verifyAdminSessionFromRequest: ReturnType<typeof vi.fn>;
	getCanonicalUserSessionFromCookieHeader: ReturnType<typeof vi.fn>;
	getUserSessionFromCookieHeader: ReturnType<typeof vi.fn>;
	getUserAuthCookieOptions: ReturnType<typeof vi.fn>;
	touchContext: ReturnType<typeof vi.fn>;
	logWarn: ReturnType<typeof vi.fn>;
	getUserActionPolicyDecision: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const verifyAdminSessionFromRequest = vi.fn().mockResolvedValue(null);
	const getCanonicalUserSessionFromCookieHeader = vi.fn().mockResolvedValue({
		isAuthenticated: true,
		email: "owen@example.com",
		userId: "019b0000-0000-7000-8000-000000000001",
	});
	const getUserSessionFromCookieHeader = vi.fn().mockReturnValue({
		isAuthenticated: true,
		email: "owen@example.com",
		userId: "019b0000-0000-7000-8000-000000000001",
	});
	const getUserAuthCookieOptions = vi.fn().mockReturnValue({
		httpOnly: true,
		secure: false,
		sameSite: "lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 30,
	});
	const touchContext = vi.fn().mockResolvedValue(undefined);
	const logWarn = vi.fn();
	const getUserActionPolicyDecision = vi.fn().mockResolvedValue({
		allowed: true,
		restriction: null,
		reason: null,
	});

	vi.doMock("@/features/auth/admin-auth-token", () => ({
		verifyAdminSessionFromRequest,
	}));

	vi.doMock("@/features/auth/user-session-cookie", () => ({
		USER_AUTH_COOKIE_NAME: "oooc_user_session",
		getCanonicalUserSessionFromCookieHeader,
		getUserSessionFromCookieHeader,
		getUserAuthCookieOptions,
	}));
	vi.doMock("@/lib/platform/postgres/user-repository", () => ({
		getUserRepository: () => ({ touchContext }),
	}));
	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			warn: logWarn,
		},
	}));
	vi.doMock("@/features/users/policy", () => ({
		getUserActionPolicyDecision,
	}));

	const route = await import("@/app/api/auth/session/route");
	return {
		GET: route.GET,
		DELETE: route.DELETE,
		verifyAdminSessionFromRequest,
		getCanonicalUserSessionFromCookieHeader,
		getUserSessionFromCookieHeader,
		getUserAuthCookieOptions,
		touchContext,
		logWarn,
		getUserActionPolicyDecision,
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
			getCanonicalUserSessionFromCookieHeader,
			getUserSessionFromCookieHeader,
			touchContext,
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
			userId: string | null;
		};

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			isAuthenticated: true,
			isAdminAuthenticated: true,
			email: "owen@example.com",
			userId: "019b0000-0000-7000-8000-000000000001",
		});
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(response.headers.get("pragma")).toBe("no-cache");
		expect(response.headers.get("expires")).toBe("0");
		expect(getCanonicalUserSessionFromCookieHeader).toHaveBeenCalledWith(
			"test-token",
		);
		expect(getUserSessionFromCookieHeader).toHaveBeenCalledTimes(0);
		expect(verifyAdminSessionFromRequest).toHaveBeenCalledTimes(1);
		expect(touchContext).toHaveBeenCalledWith({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "owen@example.com",
		});
	});

	it("keeps session reads working when last-seen tracking fails", async () => {
		const { GET, touchContext, logWarn } = await loadRoute();
		touchContext.mockRejectedValue(new Error("database unavailable"));

		const response = await GET(
			new NextRequest("https://example.com/api/auth/session", {
				headers: {
					cookie: "oooc_user_session=test-token",
				},
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			isAuthenticated: boolean;
		};

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			success: true,
			isAuthenticated: true,
		});
		expect(logWarn).toHaveBeenCalledWith(
			"auth-session",
			"Failed to update user last-seen timestamp",
			{ message: "database unavailable" },
		);
	});

	it("signs the user out before last-seen tracking when login policy denies", async () => {
		const { GET, getUserActionPolicyDecision, touchContext } =
			await loadRoute();
		getUserActionPolicyDecision.mockResolvedValue({
			allowed: false,
			restriction: {
				id: "rst_1",
				scope: "auth.login",
			},
			reason: "Account access is paused.",
		});

		const response = await GET(
			new NextRequest("https://example.com/api/auth/session", {
				headers: {
					cookie: "oooc_user_session=test-token",
				},
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			isAuthenticated: boolean;
			email: string | null;
			userId: string | null;
		};
		const setCookie = response.headers.get("set-cookie") ?? "";

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			success: true,
			isAuthenticated: false,
			email: null,
			userId: null,
		});
		expect(setCookie).toContain("oooc_user_session=");
		expect(setCookie.toLowerCase()).toContain("max-age=0");
		expect(getUserActionPolicyDecision).toHaveBeenCalledWith({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "owen@example.com",
			scope: "auth.login",
		});
		expect(touchContext).not.toHaveBeenCalled();
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
