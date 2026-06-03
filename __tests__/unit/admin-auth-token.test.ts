import { afterEach, describe, expect, it, vi } from "vitest";

const loadTtlHelper = async () => {
	vi.resetModules();
	const module = await import("@/features/auth/admin-auth-token");
	return module.getAdminAuthTtlSeconds;
};

describe("admin auth token helpers", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("defaults admin sessions to 24 hours", async () => {
		vi.stubEnv("ADMIN_AUTH_TTL_HOURS", "");
		const getAdminAuthTtlSeconds = await loadTtlHelper();

		expect(getAdminAuthTtlSeconds()).toBe(24 * 60 * 60);
	});

	it("uses a configured positive hour value", async () => {
		vi.stubEnv("ADMIN_AUTH_TTL_HOURS", "48");
		const getAdminAuthTtlSeconds = await loadTtlHelper();

		expect(getAdminAuthTtlSeconds()).toBe(48 * 60 * 60);
	});

	it("falls back to default for invalid values", async () => {
		vi.stubEnv("ADMIN_AUTH_TTL_HOURS", "forever");
		const getAdminAuthTtlSeconds = await loadTtlHelper();

		expect(getAdminAuthTtlSeconds()).toBe(24 * 60 * 60);
	});

	it("caps configured admin sessions at 7 days", async () => {
		vi.stubEnv("ADMIN_AUTH_TTL_HOURS", "720");
		const getAdminAuthTtlSeconds = await loadTtlHelper();

		expect(getAdminAuthTtlSeconds()).toBe(7 * 24 * 60 * 60);
	});
});
