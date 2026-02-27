import type {
	UserCollectionAnalytics,
	UserRecord,
} from "@/features/auth/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredUser = UserRecord & {
	submissions: number;
	firstSeenAt: string;
};

const normalize = (input: UserRecord): UserRecord => ({
	firstName: input.firstName.trim(),
	lastName: input.lastName.trim(),
	email: input.email.trim().toLowerCase(),
	consent: Boolean(input.consent),
	source: input.source.trim() || "fete-finder-auth",
	timestamp: input.timestamp || new Date().toISOString(),
});

const toSortedUsers = (store: Map<string, StoredUser>): UserRecord[] =>
	Array.from(store.values())
		.sort((left, right) => right.timestamp.localeCompare(left.timestamp))
		.map((record) => ({
			firstName: record.firstName,
			lastName: record.lastName,
			email: record.email,
			consent: record.consent,
			source: record.source,
			timestamp: record.timestamp,
		}));

const buildAnalytics = (
	store: Map<string, StoredUser>,
	nowMs = Date.now(),
): UserCollectionAnalytics => {
	const values = Array.from(store.values());
	if (values.length === 0) {
		return {
			totalUsers: 0,
			totalSubmissions: 0,
			consentedUsers: 0,
			nonConsentedUsers: 0,
			submissionsLast24Hours: 0,
			submissionsLast7Days: 0,
			uniqueSources: 0,
			topSources: [],
			firstCapturedAt: null,
			lastCapturedAt: null,
		};
	}

	const totalSubmissions = values.reduce(
		(total, record) => total + record.submissions,
		0,
	);
	const consentedUsers = values.filter((record) => record.consent).length;
	const sourceTotals = new Map<string, { source: string; users: number; submissions: number }>();
	let submissionsLast24Hours = 0;
	let submissionsLast7Days = 0;

	for (const record of values) {
		const sourceEntry = sourceTotals.get(record.source);
		if (!sourceEntry) {
			sourceTotals.set(record.source, {
				source: record.source,
				users: 1,
				submissions: record.submissions,
			});
		} else {
			sourceTotals.set(record.source, {
				source: record.source,
				users: sourceEntry.users + 1,
				submissions: sourceEntry.submissions + record.submissions,
			});
		}

		const recordMs = new Date(record.timestamp).getTime();
		if (!Number.isFinite(recordMs)) continue;
		const ageMs = nowMs - recordMs;
		if (ageMs <= 24 * 60 * 60 * 1000) {
			submissionsLast24Hours += record.submissions;
		}
		if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
			submissionsLast7Days += record.submissions;
		}
	}

	const firstCapturedAt =
		values
			.map((record) => record.firstSeenAt)
			.sort((left, right) => left.localeCompare(right))[0] ?? null;
	const lastCapturedAt =
		values
			.map((record) => record.timestamp)
			.sort((left, right) => right.localeCompare(left))[0] ?? null;

	return {
		totalUsers: values.length,
		totalSubmissions,
		consentedUsers,
		nonConsentedUsers: values.length - consentedUsers,
		submissionsLast24Hours,
		submissionsLast7Days,
		uniqueSources: sourceTotals.size,
		topSources: Array.from(sourceTotals.values()).sort((left, right) => {
			if (right.users !== left.users) return right.users - left.users;
			return right.submissions - left.submissions;
		}),
		firstCapturedAt,
		lastCapturedAt,
	};
};

const loadStore = async () => {
	vi.resetModules();

	const backing = new Map<string, StoredUser>();
	const repository = {
		addOrUpdate: vi.fn(async (input: UserRecord) => {
			const normalized = normalize(input);
			const existing = backing.get(normalized.email);
			backing.set(normalized.email, {
				...normalized,
				submissions: (existing?.submissions ?? 0) + 1,
				firstSeenAt: existing?.firstSeenAt ?? normalized.timestamp,
			});
			return {
				record: normalized,
				alreadyExisted: Boolean(existing),
			};
		}),
		listAll: vi.fn(async () => toSortedUsers(backing)),
		getAnalytics: vi.fn(async () => buildAnalytics(backing)),
		getSnapshot: vi.fn(async () => {
			const users = toSortedUsers(backing);
			const analytics = buildAnalytics(backing);
			return {
				users,
				analytics,
				totalUsers: analytics.totalUsers,
				lastUpdatedAt: analytics.lastCapturedAt,
			};
		}),
		clearAll: vi.fn(async () => {
			backing.clear();
		}),
	};

	vi.doMock("@/lib/platform/postgres/user-collection-repository", () => ({
		getUserCollectionRepository: () => repository,
	}));

	const { UserCollectionStore } = await import(
		"@/features/auth/user-collection-store"
	);

	return { UserCollectionStore, repository };
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
