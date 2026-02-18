import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
	process.env = { ...ORIGINAL_ENV };
	delete process.env.VERCEL;
	delete process.env.VERCEL_ENV;
	delete process.env.NEXT_RUNTIME;
};

describe("kv-store-factory", () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		resetEnv();
	});

	it("throws in Vercel preview/production strict mode when Postgres is not configured", async () => {
		process.env.VERCEL = "1";
		process.env.VERCEL_ENV = "preview";
		process.env.NEXT_RUNTIME = "nodejs";

		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			isPostgresConfigured: () => false,
		}));

		const { getKVStore } = await import("@/lib/platform/kv/kv-store-factory");

		await expect(getKVStore()).rejects.toThrow(
			"KV strict mode is active in Vercel preview/production. Configure DATABASE_URL for Postgres KV.",
		);
	});

	it("throws in Vercel preview/production strict mode when Postgres init fails", async () => {
		process.env.VERCEL = "1";
		process.env.VERCEL_ENV = "production";
		process.env.NEXT_RUNTIME = "nodejs";

		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			isPostgresConfigured: () => true,
		}));

		vi.doMock("@/lib/platform/kv/postgres-kv-store", () => ({
			PostgresKVStore: class {
				async get(): Promise<string | null> {
					throw new Error("db unavailable");
				}
			},
		}));

		const { getKVStore } = await import("@/lib/platform/kv/kv-store-factory");

		await expect(getKVStore()).rejects.toThrow(
			"Failed to initialize Postgres KV store in strict mode.",
		);
	});

	it("falls back to file KV in local dev/test when Postgres is unavailable", async () => {
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			isPostgresConfigured: () => false,
		}));

		vi.doMock("@/lib/platform/kv/file-kv-store", () => ({
			FileKVStore: class {
				async list(): Promise<string[]> {
					return [];
				}
			},
		}));

		vi.doMock("@/lib/platform/kv/memory-kv-store", () => ({
			MemoryKVStore: class {
				async get(): Promise<string | null> {
					return null;
				}
				async set(): Promise<void> {}
				async delete(): Promise<void> {}
				async list(): Promise<string[]> {
					return [];
				}
			},
		}));

		const { getKVStoreInfo } = await import("@/lib/platform/kv/kv-store-factory");
		const info = await getKVStoreInfo();

		expect(info.provider).toBe("file");
	});

	it("falls back to memory KV in local dev/test when file KV init fails", async () => {
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			isPostgresConfigured: () => false,
		}));

		vi.doMock("@/lib/platform/kv/file-kv-store", () => ({
			FileKVStore: class {
				async list(): Promise<string[]> {
					throw new Error("file unavailable");
				}
			},
		}));

		vi.doMock("@/lib/platform/kv/memory-kv-store", () => ({
			MemoryKVStore: class {
				async get(): Promise<string | null> {
					return null;
				}
				async set(): Promise<void> {}
				async delete(): Promise<void> {}
				async list(): Promise<string[]> {
					return [];
				}
			},
		}));

		const { getKVStoreInfo } = await import("@/lib/platform/kv/kv-store-factory");
		const info = await getKVStoreInfo();

		expect(info.provider).toBe("memory");
	});
});
