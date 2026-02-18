import { beforeEach, describe, expect, it, vi } from "vitest";

type RepositoryMock = {
	consumeWindow: ReturnType<typeof vi.fn>;
	cleanupExpired: ReturnType<typeof vi.fn>;
};

const loadLimiter = async (options?: {
	repositoryAvailable?: boolean;
}): Promise<{
	repository: RepositoryMock;
	limiter: typeof import("@/features/security/rate-limiter");
}> => {
	vi.resetModules();

	const repository: RepositoryMock = {
		consumeWindow: vi.fn(),
		cleanupExpired: vi.fn(),
	};

	vi.doMock("@/lib/config/env", () => ({
		env: {
			AUTH_SECRET:
				"test-auth-secret-with-minimum-length-32-characters-123456789",
		},
	}));

	vi.doMock("@/lib/platform/postgres/rate-limit-repository", () => ({
		getRateLimitRepository: vi.fn(() =>
			options?.repositoryAvailable === false ? null : repository,
		),
	}));

	const limiter = await import("@/features/security/rate-limiter");
	return { repository, limiter };
};

describe("rate-limiter helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("extracts client IP with x-forwarded-for precedence", async () => {
		const { limiter } = await loadLimiter();

		const forwardedHeaders = new Headers({
			"x-forwarded-for": "198.51.100.15, 10.0.0.1",
			"x-real-ip": "203.0.113.22",
		});
		const realIpHeaders = new Headers({
			"x-real-ip": "203.0.113.33",
		});
		const emptyHeaders = new Headers();

		expect(limiter.extractClientIpFromHeaders(forwardedHeaders)).toBe(
			"198.51.100.15",
		);
		expect(limiter.extractClientIpFromHeaders(realIpHeaders)).toBe(
			"203.0.113.33",
		);
		expect(limiter.extractClientIpFromHeaders(emptyHeaders)).toBe("unknown");
	});

	it("builds deterministic HMAC key hashes without leaking raw identifiers", async () => {
		const { limiter } = await loadLimiter();

		const hashA1 = limiter.buildRateLimitKeyHash([
			"auth_verify_ip",
			"203.0.113.5",
		]);
		const hashA2 = limiter.buildRateLimitKeyHash([
			"auth_verify_ip",
			"203.0.113.5",
		]);
		const hashB = limiter.buildRateLimitKeyHash([
			"auth_verify_ip",
			"203.0.113.6",
		]);

		expect(hashA1).toBe(hashA2);
		expect(hashA1).not.toBe(hashB);
		expect(hashA1).toMatch(/^[0-9a-f]{64}$/);
		expect(hashA1.includes("203.0.113.5")).toBe(false);
	});

	it("returns blocked decision and retry-after when IP counter is over limit", async () => {
		const { repository, limiter } = await loadLimiter();
		repository.consumeWindow.mockResolvedValue({
			allowed: false,
			count: 61,
			limit: 60,
			resetAt: "2026-06-21T00:00:00.000Z",
			retryAfterSeconds: 14,
		});

		const decision = await limiter.checkAuthVerifyIpLimit("203.0.113.8");

		expect(decision).toMatchObject({
			allowed: false,
			reason: "ip_limit",
			retryAfterSeconds: 14,
			scope: "auth_verify_ip",
		});
	});

	it("returns fail-open decision when limiter repository is unavailable", async () => {
		const { limiter } = await loadLimiter({ repositoryAvailable: false });

		const decision = await limiter.checkAuthVerifyEmailIpLimit(
			"user@example.com",
			"203.0.113.9",
		);

		expect(decision).toMatchObject({
			allowed: true,
			reason: "limiter_unavailable",
			retryAfterSeconds: null,
			scope: "auth_verify_email_ip",
		});
	});

	it("enforces event submit fingerprint cooldown limits", async () => {
		const { repository, limiter } = await loadLimiter();
		repository.consumeWindow.mockResolvedValue({
			allowed: false,
			count: 2,
			limit: 1,
			resetAt: "2026-06-22T00:00:00.000Z",
			retryAfterSeconds: 1800,
		});

		const decision = await limiter.checkEventSubmitFingerprintLimit(
			"same-event-fingerprint",
		);

		expect(decision).toMatchObject({
			allowed: false,
			reason: "fingerprint_limit",
			retryAfterSeconds: 1800,
			scope: "event_submit_fingerprint",
		});
	});

	it("enforces event submit email+IP scope with normalized identifiers", async () => {
		const { repository, limiter } = await loadLimiter();
		repository.consumeWindow.mockResolvedValue({
			allowed: true,
			count: 1,
			limit: 5,
			resetAt: "2026-06-22T00:00:00.000Z",
			retryAfterSeconds: 60,
		});

		await limiter.checkEventSubmitEmailIpLimit(
			"Host@Example.com",
			"203.0.113.99",
		);

		expect(repository.consumeWindow).toHaveBeenCalledWith(
			expect.objectContaining({
				scope: "event_submit_email_ip",
				windowSeconds: 3600,
				limit: 5,
			}),
		);
	});

	it("cleans up expired counters through repository", async () => {
		const { repository, limiter } = await loadLimiter();
		repository.cleanupExpired.mockResolvedValue(12);

		const deleted = await limiter.cleanupAuthVerifyRateLimits(86_400);

		expect(deleted).toBe(12);
		expect(repository.cleanupExpired).toHaveBeenCalledWith(86_400);
	});
});
