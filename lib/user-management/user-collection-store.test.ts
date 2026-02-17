import { beforeEach, describe, expect, it, vi } from "vitest";

type MockKVStore = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
};

const loadStore = async () => {
	vi.resetModules();

	const backing = new Map<string, string>();
	const kv: MockKVStore = {
		get: vi.fn(async (key: string) => backing.get(key) ?? null),
		set: vi.fn(async (key: string, value: string) => {
			backing.set(key, value);
		}),
		delete: vi.fn(async (key: string) => {
			backing.delete(key);
		}),
		list: vi.fn(async () => Array.from(backing.keys())),
	};

	vi.doMock("@/lib/platform/kv/kv-store-factory", () => ({
		getKVStore: async () => kv,
		getKVStoreInfo: async () => ({
			provider: "postgres" as const,
			location: "Postgres table app_kv_store (DATABASE_URL)",
		}),
	}));

	const { UserCollectionStore } = await import(
		"@/lib/user-management/user-collection-store"
	);

	return { UserCollectionStore, kv };
};

describe("UserCollectionStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deduplicates by email and tracks submission count", async () => {
		const { UserCollectionStore } = await loadStore();

		await UserCollectionStore.addOrUpdate({
			firstName: "Owen",
			lastName: "A",
			email: "owen@example.com",
			consent: true,
			source: "auth-modal",
			timestamp: "2026-02-17T10:00:00.000Z",
		});

		await UserCollectionStore.addOrUpdate({
			firstName: "Owen",
			lastName: "A",
			email: "OWEN@example.com",
			consent: true,
			source: "auth-modal",
			timestamp: "2026-02-17T11:00:00.000Z",
		});

		const list = await UserCollectionStore.listAll();
		const analytics = await UserCollectionStore.getAnalytics();
		const status = await UserCollectionStore.getStatus();

		expect(list).toHaveLength(1);
		expect(list[0]?.email).toBe("owen@example.com");
		expect(analytics.totalUsers).toBe(1);
		expect(analytics.totalSubmissions).toBe(2);
		expect(analytics.topSources[0]).toEqual({
			source: "auth-modal",
			users: 1,
			submissions: 2,
		});
		expect(status.provider).toBe("postgres");
	});

	it("reports recency windows and source breakdown", async () => {
		const { UserCollectionStore } = await loadStore();
		const now = Date.now();
		const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
		const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();

		await UserCollectionStore.addOrUpdate({
			firstName: "Recent",
			lastName: "User",
			email: "recent@example.com",
			consent: true,
			source: "fete-finder-auth",
			timestamp: oneHourAgo,
		});
		await UserCollectionStore.addOrUpdate({
			firstName: "Recent",
			lastName: "User",
			email: "recent@example.com",
			consent: true,
			source: "fete-finder-auth",
			timestamp: oneHourAgo,
		});
		await UserCollectionStore.addOrUpdate({
			firstName: "Old",
			lastName: "User",
			email: "old@example.com",
			consent: false,
			source: "manual-import",
			timestamp: eightDaysAgo,
		});

		const analytics = await UserCollectionStore.getAnalytics();

		expect(analytics.totalUsers).toBe(2);
		expect(analytics.totalSubmissions).toBe(3);
		expect(analytics.submissionsLast24Hours).toBe(2);
		expect(analytics.submissionsLast7Days).toBe(2);
		expect(analytics.consentedUsers).toBe(1);
		expect(analytics.nonConsentedUsers).toBe(1);
		expect(analytics.uniqueSources).toBe(2);
		expect(analytics.firstCapturedAt).not.toBeNull();
		expect(analytics.lastCapturedAt).not.toBeNull();
	});
});
