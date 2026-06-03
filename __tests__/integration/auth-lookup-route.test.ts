import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	POST: typeof import("@/app/api/auth/lookup/route").POST;
	getUserProfile: ReturnType<typeof vi.fn>;
	checkAuthLookupIpLimit: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const getUserProfile = vi.fn().mockResolvedValue(null);
	const checkAuthLookupIpLimit = vi.fn().mockResolvedValue({
		allowed: true,
		retryAfterSeconds: null,
		reason: "ok",
		scope: "auth_lookup_ip",
		keyHash: "hashed-lookup-ip",
	});

	vi.doMock("@/features/auth/user-collection-store", () => ({
		UserCollectionStore: {
			getUserProfile,
		},
	}));

	vi.doMock("@/features/security/rate-limiter", () => ({
		checkAuthLookupIpLimit,
		extractClientIpFromHeaders: (headers: Pick<Headers, "get">) =>
			headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
	}));

	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			warn: vi.fn(),
		},
	}));

	const route = await import("@/app/api/auth/lookup/route");
	return {
		POST: route.POST,
		getUserProfile,
		checkAuthLookupIpLimit,
	};
};

describe("/api/auth/lookup route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("asks for name and consent when no profile is on file", async () => {
		const { POST, checkAuthLookupIpLimit } = await loadRoute();

		const response = await POST(
			new Request("https://example.com/api/auth/lookup", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.20",
				},
				body: JSON.stringify({ email: "NEW@example.com" }),
			}),
		);
		const payload = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			email: "new@example.com",
			requiresName: true,
			requiresConsent: true,
		});
		expect(checkAuthLookupIpLimit).toHaveBeenCalledWith("203.0.113.20");
	});

	it("returns only required-field flags for stored profiles", async () => {
		const { POST, getUserProfile } = await loadRoute();
		getUserProfile.mockResolvedValue({
			user: {
				firstName: "Private",
				lastName: "Person",
				email: "known@example.com",
				timestamp: "2026-05-08T00:00:00.000Z",
				consent: true,
				termsVersion: "2026-06-03",
				termsAcceptedAt: "2026-06-03T00:00:00.000Z",
				privacyVersion: "2026-06-01",
				privacyAcceptedAt: "2026-06-03T00:00:00.000Z",
				source: "auth-modal",
			},
		});

		const response = await POST(
			new Request("https://example.com/api/auth/lookup", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.21",
				},
				body: JSON.stringify({ email: "KNOWN@example.com" }),
			}),
		);
		const payload = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			email: "known@example.com",
			requiresName: false,
			requiresConsent: false,
		});
		expect(payload).not.toHaveProperty("firstName");
		expect(payload).not.toHaveProperty("lastName");
		expect(payload).not.toHaveProperty("exists");
	});

	it("requires name again when a stored profile has invalid name characters", async () => {
		const { POST, getUserProfile } = await loadRoute();
		getUserProfile.mockResolvedValue({
			user: {
				firstName: "Pris",
				lastName: "🥀",
				email: "known@example.com",
				timestamp: "2026-05-08T00:00:00.000Z",
				consent: true,
				termsVersion: "2026-06-03",
				termsAcceptedAt: "2026-06-03T00:00:00.000Z",
				privacyVersion: "2026-06-01",
				privacyAcceptedAt: "2026-06-03T00:00:00.000Z",
				source: "auth-modal",
			},
		});

		const response = await POST(
			new Request("https://example.com/api/auth/lookup", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.23",
				},
				body: JSON.stringify({ email: "KNOWN@example.com" }),
			}),
		);
		const payload = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			email: "known@example.com",
			requiresName: true,
			requiresConsent: false,
		});
	});

	it("returns 429 when lookup rate limit is exceeded", async () => {
		const { POST, checkAuthLookupIpLimit, getUserProfile } = await loadRoute();
		checkAuthLookupIpLimit.mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 30,
			reason: "ip_limit",
			scope: "auth_lookup_ip",
			keyHash: "hashed-lookup-ip",
		});

		const response = await POST(
			new Request("https://example.com/api/auth/lookup", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-forwarded-for": "203.0.113.22",
				},
				body: JSON.stringify({ email: "known@example.com" }),
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("30");
		expect(getUserProfile).not.toHaveBeenCalled();
	});
});
