import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	POST: typeof import("@/app/api/auth/verify/route").POST;
	addOrUpdate: ReturnType<typeof vi.fn>;
	getUserProfile: ReturnType<typeof vi.fn>;
	getStatus: ReturnType<typeof vi.fn>;
	checkAuthVerifyIpLimit: ReturnType<typeof vi.fn>;
	checkAuthVerifyEmailIpLimit: ReturnType<typeof vi.fn>;
	logWarn: ReturnType<typeof vi.fn>;
	attachEventUserToSession: ReturnType<typeof vi.fn>;
	attachDiscoveryUserToSession: ReturnType<typeof vi.fn>;
};

const validBody = {
	firstName: "Owen",
	lastName: "Hahaha",
	email: "OWEN@example.com",
	consent: true,
	termsAccepted: true,
	privacyAccepted: true,
	marketingConsent: false,
	source: "auth-modal",
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const addOrUpdate = vi.fn().mockResolvedValue({
		record: {
			userId: "019b0000-0000-7000-8000-000000000001",
			firstName: "Owen",
			lastName: "Hahaha",
			email: "owen@example.com",
			timestamp: "2026-05-08T00:00:00.000Z",
			consent: true,
			termsVersion: "2026-06-03",
			termsAcceptedAt: "2026-06-03T00:00:00.000Z",
			privacyVersion: "2026-06-01",
			privacyAcceptedAt: "2026-06-03T00:00:00.000Z",
			marketingConsent: false,
			eventUpdateConsent: false,
			source: "auth-modal",
		},
		alreadyExisted: false,
	});
	const getUserProfile = vi.fn().mockResolvedValue(null);
	const getStatus = vi.fn().mockResolvedValue({ provider: "postgres" });
	const checkAuthVerifyIpLimit = vi.fn().mockResolvedValue({
		allowed: true,
		retryAfterSeconds: null,
		reason: "ok",
		scope: "auth_verify_ip",
		keyHash: "hashed-ip",
	});
	const checkAuthVerifyEmailIpLimit = vi.fn().mockResolvedValue({
		allowed: true,
		retryAfterSeconds: null,
		reason: "ok",
		scope: "auth_verify_email_ip",
		keyHash: "hashed-email-ip",
	});
	const logWarn = vi.fn();
	const attachEventUserToSession = vi.fn().mockResolvedValue(0);
	const attachDiscoveryUserToSession = vi.fn().mockResolvedValue(0);

	vi.doMock("@/features/auth/user-collection-store", () => ({
		UserCollectionStore: {
			addOrUpdate,
			getUserProfile,
			getStatus,
		},
	}));

	vi.doMock("@/features/security/rate-limiter", () => ({
		checkAuthVerifyIpLimit,
		checkAuthVerifyEmailIpLimit,
		extractClientIpFromHeaders: (headers: Pick<Headers, "get">) =>
			headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
	}));

	vi.doMock("@/features/auth/user-session-cookie", () => ({
		USER_AUTH_COOKIE_NAME: "oooc_user_session",
		signUserSessionToken: vi.fn(() => "signed-auth-token"),
		getUserAuthCookieOptions: vi.fn(() => ({
			httpOnly: true,
			secure: false,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		})),
	}));

	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			info: vi.fn(),
			warn: logWarn,
			error: vi.fn(),
		},
	}));

	vi.doMock("@/lib/platform/postgres/event-engagement-repository", () => ({
		getEventEngagementRepository: () => ({
			attachUserToSession: attachEventUserToSession,
		}),
	}));

	vi.doMock("@/lib/platform/postgres/discovery-analytics-repository", () => ({
		getDiscoveryAnalyticsRepository: () => ({
			attachUserToSession: attachDiscoveryUserToSession,
		}),
	}));

	const route = await import("@/app/api/auth/verify/route");
	return {
		POST: route.POST,
		addOrUpdate,
		getUserProfile,
		getStatus,
		checkAuthVerifyIpLimit,
		checkAuthVerifyEmailIpLimit,
		logWarn,
		attachEventUserToSession,
		attachDiscoveryUserToSession,
	};
};

describe("/api/auth/verify route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 429 when IP rate limit is exceeded", async () => {
		const {
			POST,
			checkAuthVerifyIpLimit,
			checkAuthVerifyEmailIpLimit,
			addOrUpdate,
		} = await loadRoute();
		checkAuthVerifyIpLimit.mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 45,
			reason: "ip_limit",
			scope: "auth_verify_ip",
			keyHash: "hashed-ip",
		});

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.10",
				},
				body: JSON.stringify(validBody),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			error: string;
		};

		expect(response.status).toBe(429);
		expect(payload).toEqual({
			success: false,
			error: "Too many attempts. Please try again shortly.",
		});
		expect(response.headers.get("retry-after")).toBe("45");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(checkAuthVerifyEmailIpLimit).not.toHaveBeenCalled();
		expect(addOrUpdate).not.toHaveBeenCalled();
	});

	it("returns 429 when email+IP rate limit is exceeded", async () => {
		const { POST, checkAuthVerifyEmailIpLimit, addOrUpdate } =
			await loadRoute();
		checkAuthVerifyEmailIpLimit.mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 120,
			reason: "email_ip_limit",
			scope: "auth_verify_email_ip",
			keyHash: "hashed-email-ip",
		});

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.11",
				},
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("120");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(addOrUpdate).not.toHaveBeenCalled();
	});

	it("rejects names with emoji or symbols", async () => {
		const { POST, addOrUpdate, checkAuthVerifyEmailIpLimit } =
			await loadRoute();

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.16",
				},
				body: JSON.stringify({
					...validBody,
					firstName: "Pris",
					lastName: "🥀",
				}),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			error: string;
		};

		expect(response.status).toBe(400);
		expect(payload).toEqual({
			success: false,
			error:
				"Last name can only include letters, spaces, hyphens, or apostrophes",
		});
		expect(checkAuthVerifyEmailIpLimit).not.toHaveBeenCalled();
		expect(addOrUpdate).not.toHaveBeenCalled();
	});

	it("succeeds under threshold and sets auth cookie", async () => {
		const {
			POST,
			addOrUpdate,
			getStatus,
			checkAuthVerifyIpLimit,
			checkAuthVerifyEmailIpLimit,
		} = await loadRoute();

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.12",
				},
				body: JSON.stringify(validBody),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			email: string;
			userId: string;
			storedIn: string;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.email).toBe("owen@example.com");
		expect(payload.userId).toBe("019b0000-0000-7000-8000-000000000001");
		expect(payload.storedIn).toBe("postgres");
		expect(response.headers.get("set-cookie")).toContain("oooc_user_session=");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(checkAuthVerifyIpLimit).toHaveBeenCalledWith("203.0.113.12");
		expect(checkAuthVerifyEmailIpLimit).toHaveBeenCalledWith(
			"owen@example.com",
			"203.0.113.12",
		);
		expect(addOrUpdate).toHaveBeenCalledTimes(1);
		expect(addOrUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				consent: true,
				termsVersion: "2026-06-03",
				termsAcceptedAt: expect.any(String),
				privacyVersion: "2026-06-01",
				privacyAcceptedAt: expect.any(String),
				marketingConsent: false,
				eventUpdateConsent: false,
			}),
		);
		expect(getStatus).toHaveBeenCalledTimes(1);
	});

	it("links recent anonymous activity to the verified user", async () => {
		const { POST, attachEventUserToSession, attachDiscoveryUserToSession } =
			await loadRoute();
		attachEventUserToSession.mockResolvedValue(2);
		attachDiscoveryUserToSession.mockResolvedValue(3);

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.15",
				},
				body: JSON.stringify({
					...validBody,
					anonymousSessionId: "anon-session-123",
					clientContext: {
						deviceClass: "mobile",
						platform: "ios",
						browserFamily: "safari",
						timezone: "Europe/London",
						locale: "en-GB",
					},
				}),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			linkedBehaviorRows: number;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.linkedBehaviorRows).toBe(5);
		expect(attachEventUserToSession).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "anon-session-123",
				userId: "019b0000-0000-7000-8000-000000000001",
				userEmail: "owen@example.com",
				deviceClass: "mobile",
				platform: "ios",
				browserFamily: "safari",
				timezone: "Europe/London",
				locale: "en-GB",
			}),
		);
		expect(attachDiscoveryUserToSession).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "anon-session-123",
				userId: "019b0000-0000-7000-8000-000000000001",
				userEmail: "owen@example.com",
			}),
		);
	});

	it("reuses stored name and consent for a returning email", async () => {
		const { POST, addOrUpdate, getUserProfile } = await loadRoute();
		getUserProfile.mockResolvedValue({
			user: {
				userId: "019b0000-0000-7000-8000-000000000123",
				firstName: "Stored",
				lastName: "Guest",
				email: "returning@example.com",
				timestamp: "2026-05-08T00:00:00.000Z",
				consent: true,
				termsVersion: "2026-06-03",
				termsAcceptedAt: "2026-06-03T00:00:00.000Z",
				privacyVersion: "2026-06-01",
				privacyAcceptedAt: "2026-06-03T00:00:00.000Z",
				marketingConsent: true,
				eventUpdateConsent: true,
				source: "auth-modal",
			},
		});

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.14",
				},
				body: JSON.stringify({
					email: "RETURNING@example.com",
					source: "auth-modal",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(addOrUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				firstName: "Stored",
				lastName: "Guest",
				email: "returning@example.com",
				consent: true,
				termsVersion: "2026-06-03",
				privacyVersion: "2026-06-01",
				marketingConsent: true,
				eventUpdateConsent: true,
			}),
		);
	});

	it("fails open and logs hashed context when limiter is unavailable", async () => {
		const {
			POST,
			checkAuthVerifyIpLimit,
			checkAuthVerifyEmailIpLimit,
			logWarn,
		} = await loadRoute();
		checkAuthVerifyIpLimit.mockResolvedValue({
			allowed: true,
			retryAfterSeconds: null,
			reason: "limiter_unavailable",
			scope: "auth_verify_ip",
			keyHash: "hashed-ip-only",
		});
		checkAuthVerifyEmailIpLimit.mockResolvedValue({
			allowed: true,
			retryAfterSeconds: null,
			reason: "limiter_unavailable",
			scope: "auth_verify_email_ip",
			keyHash: "hashed-email-ip-only",
		});

		const response = await POST(
			new Request("https://example.com/api/auth/verify", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.13",
				},
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(200);
		expect(logWarn).toHaveBeenCalled();
		const [scope, message, context] = logWarn.mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(scope).toBe("auth-verify");
		expect(message).toContain("Rate limiter unavailable");
		expect(context).toMatchObject({
			reason: "limiter_unavailable",
		});
		expect(String(context.keyHash)).toContain("hashed");
		expect(JSON.stringify(context)).not.toContain("203.0.113.13");
		expect(JSON.stringify(context)).not.toContain("owen@example.com");
	});
});
