import "server-only";

import type {
	UserCollectionAnalytics,
	UserRecord,
} from "@/features/auth/types";
import {
	getUserCollectionRepository,
	type UserCollectionStoreSnapshot,
} from "@/lib/platform/postgres/user-collection-repository";

const MAX_USERS = 10_000;

type StoredUserRecord = UserRecord & {
	submissions: number;
	firstSeenAt: string;
};

declare global {
	var __ooocFeteFinderUserCollectionMemoryStore:
		| Record<string, StoredUserRecord>
		| undefined;
}

const emptyAnalytics = (): UserCollectionAnalytics => ({
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
});

const normalizeUserRecord = (user: UserRecord): UserRecord => ({
	firstName: user.firstName.trim(),
	lastName: user.lastName.trim(),
	email: user.email.trim().toLowerCase(),
	timestamp: user.timestamp || new Date().toISOString(),
	consent: Boolean(user.consent),
	source: user.source.trim() || "fete-finder-auth",
});

const toSortedUserRecords = (
	records: Record<string, StoredUserRecord>,
): UserRecord[] => {
	return Object.values(records)
		.sort(
			(left, right) =>
				new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
		)
		.map((record) => ({
			firstName: record.firstName,
			lastName: record.lastName,
			email: record.email,
			timestamp: record.timestamp,
			consent: record.consent,
			source: record.source,
		}));
};

const getMemoryStore = (): Record<string, StoredUserRecord> => {
	if (!globalThis.__ooocFeteFinderUserCollectionMemoryStore) {
		globalThis.__ooocFeteFinderUserCollectionMemoryStore = {};
	}
	return globalThis.__ooocFeteFinderUserCollectionMemoryStore;
};

const getMemorySnapshot = (): UserCollectionStoreSnapshot => {
	const records = getMemoryStore();
	const users = toSortedUserRecords(records);
	const values = Object.values(records);
	if (values.length === 0) {
		return {
			users,
			analytics: emptyAnalytics(),
			totalUsers: 0,
			lastUpdatedAt: null,
		};
	}

	const totalSubmissions = values.reduce(
		(acc, record) => acc + record.submissions,
		0,
	);
	const consentedUsers = values.filter((record) => record.consent).length;
	const sources = new Map<string, { source: string; users: number; submissions: number }>();
	for (const record of values) {
		const existing = sources.get(record.source);
		if (!existing) {
			sources.set(record.source, {
				source: record.source,
				users: 1,
				submissions: record.submissions,
			});
		} else {
			sources.set(record.source, {
				source: record.source,
				users: existing.users + 1,
				submissions: existing.submissions + record.submissions,
			});
		}
	}

	const lastUpdatedAt =
		values
			.map((record) => record.timestamp)
			.sort((left, right) => (left > right ? -1 : 1))[0] ?? null;

	return {
		users,
		analytics: {
			totalUsers: values.length,
			totalSubmissions,
			consentedUsers,
			nonConsentedUsers: values.length - consentedUsers,
			submissionsLast24Hours: 0,
			submissionsLast7Days: 0,
			uniqueSources: sources.size,
			topSources: Array.from(sources.values()).sort((left, right) => {
				if (right.users !== left.users) {
					return right.users - left.users;
				}
				return right.submissions - left.submissions;
			}),
			firstCapturedAt:
				values
					.map((record) => record.firstSeenAt)
					.sort((left, right) => (left > right ? 1 : -1))[0] ?? null,
			lastCapturedAt: lastUpdatedAt,
		},
		totalUsers: values.length,
		lastUpdatedAt,
	};
};

export interface UserCollectionStoreStatus {
	provider: "file" | "memory" | "postgres";
	location: string;
	totalUsers: number;
	lastUpdatedAt: string | null;
}

export interface UserCollectionAdminSnapshot {
	users: UserRecord[];
	analytics: UserCollectionAnalytics;
	status: UserCollectionStoreStatus;
}

export class UserCollectionStore {
	static async addOrUpdate(user: UserRecord): Promise<{
		record: UserRecord;
		alreadyExisted: boolean;
	}> {
		const normalized = normalizeUserRecord(user);
		const repository = getUserCollectionRepository();
		if (repository) {
			return repository.addOrUpdate(normalized);
		}

		const store = getMemoryStore();
		const existing = store[normalized.email];
		store[normalized.email] = {
			...normalized,
			submissions: (existing?.submissions ?? 0) + 1,
			firstSeenAt: existing?.firstSeenAt ?? normalized.timestamp,
		};

		const keys = Object.keys(store);
		if (keys.length > MAX_USERS) {
			keys
				.sort((left, right) =>
					store[right].timestamp.localeCompare(store[left].timestamp),
				)
				.slice(MAX_USERS)
				.forEach((key) => {
					delete store[key];
				});
		}

		return {
			record: normalized,
			alreadyExisted: Boolean(existing),
		};
	}

	static async listAll(): Promise<UserRecord[]> {
		const repository = getUserCollectionRepository();
		if (repository) {
			return repository.listAll(MAX_USERS);
		}
		return getMemorySnapshot().users;
	}

	static async getAnalytics(): Promise<UserCollectionAnalytics> {
		const repository = getUserCollectionRepository();
		if (repository) {
			return repository.getAnalytics();
		}
		return getMemorySnapshot().analytics;
	}

	static async getAdminSnapshot(): Promise<UserCollectionAdminSnapshot> {
		const repository = getUserCollectionRepository();
		if (repository) {
			const snapshot = await repository.getSnapshot();
			return {
				users: snapshot.users,
				analytics: snapshot.analytics,
				status: {
					provider: "postgres",
					location: "Postgres tables app_user_collection_events + app_user_collection_rollup",
					totalUsers: snapshot.totalUsers,
					lastUpdatedAt: snapshot.lastUpdatedAt,
				},
			};
		}

		const snapshot = getMemorySnapshot();
		return {
			users: snapshot.users,
			analytics: snapshot.analytics,
			status: {
				provider: "memory",
				location: "in-memory fallback",
				totalUsers: snapshot.totalUsers,
				lastUpdatedAt: snapshot.lastUpdatedAt,
			},
		};
	}

	static async getStatus(): Promise<UserCollectionStoreStatus> {
		const snapshot = await this.getAdminSnapshot();
		return snapshot.status;
	}

	static async clearAll(): Promise<void> {
		const repository = getUserCollectionRepository();
		if (repository) {
			await repository.clearAll();
			return;
		}

		globalThis.__ooocFeteFinderUserCollectionMemoryStore = {};
	}
}
