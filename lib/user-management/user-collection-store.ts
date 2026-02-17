import "server-only";

import type { UserRecord } from "@/types/user";
import { getKVStore, getKVStoreInfo } from "@/lib/platform/kv/kv-store-factory";

const USERS_COLLECTION_KEY = "users:collection:v1";
const MAX_USERS = 10000;

interface StoredUserRecord extends UserRecord {
	submissions: number;
	firstSeenAt: string;
}

interface UserCollectionPayload {
	version: 1;
	updatedAt: string;
	records: Record<string, StoredUserRecord>;
}

const EMPTY_PAYLOAD: UserCollectionPayload = {
	version: 1,
	updatedAt: new Date(0).toISOString(),
	records: {},
};

const parsePayload = (raw: string | null): UserCollectionPayload => {
	if (!raw) return EMPTY_PAYLOAD;
	try {
		const parsed = JSON.parse(raw) as Partial<UserCollectionPayload>;
		if (!parsed || typeof parsed !== "object" || !parsed.records) {
			return EMPTY_PAYLOAD;
		}

		const normalizedRecords = Object.fromEntries(
			Object.entries(parsed.records).flatMap(([email, value]) => {
				if (!value || typeof value !== "object") return [];
				const record = value as Partial<StoredUserRecord>;
				if (
					typeof record.firstName !== "string" ||
					typeof record.lastName !== "string" ||
					typeof record.email !== "string" ||
					typeof record.timestamp !== "string" ||
					typeof record.source !== "string"
				) {
					return [];
				}
				return [
					[
						email,
						{
							firstName: record.firstName,
							lastName: record.lastName,
							email: record.email,
							timestamp: record.timestamp,
							consent: Boolean(record.consent),
							source: record.source,
							submissions:
								typeof record.submissions === "number" ? record.submissions : 1,
							firstSeenAt:
								typeof record.firstSeenAt === "string"
									? record.firstSeenAt
									: record.timestamp,
						} satisfies StoredUserRecord,
					],
				];
			}),
		);

		return {
			version: 1,
			updatedAt:
				typeof parsed.updatedAt === "string"
					? parsed.updatedAt
					: new Date().toISOString(),
			records: normalizedRecords,
		};
	} catch {
		return EMPTY_PAYLOAD;
	}
};

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

export interface UserCollectionStoreStatus {
	provider: "file" | "memory" | "postgres";
	location: string;
	totalUsers: number;
	lastUpdatedAt: string | null;
}

export class UserCollectionStore {
	private static async readPayload(): Promise<UserCollectionPayload> {
		const kv = await getKVStore();
		const raw = await kv.get(USERS_COLLECTION_KEY);
		return parsePayload(raw);
	}

	private static async writePayload(payload: UserCollectionPayload): Promise<void> {
		const kv = await getKVStore();
		await kv.set(USERS_COLLECTION_KEY, JSON.stringify(payload));
	}

	static async addOrUpdate(user: UserRecord): Promise<{
	record: UserRecord;
	alreadyExisted: boolean;
}> {
		const normalized = normalizeUserRecord(user);
		const payload = await this.readPayload();
		const existing = payload.records[normalized.email];

		payload.records[normalized.email] = {
			...normalized,
			submissions: (existing?.submissions ?? 0) + 1,
			firstSeenAt: existing?.firstSeenAt ?? normalized.timestamp,
		};

		const keys = Object.keys(payload.records);
		if (keys.length > MAX_USERS) {
			const sortedByRecent = keys.sort((left, right) => {
				return (
					new Date(payload.records[right].timestamp).getTime() -
					new Date(payload.records[left].timestamp).getTime()
				);
			});

			const keptKeys = new Set(sortedByRecent.slice(0, MAX_USERS));
			for (const key of keys) {
				if (!keptKeys.has(key)) {
					delete payload.records[key];
				}
			}
		}

		payload.updatedAt = new Date().toISOString();
		await this.writePayload(payload);

		return {
			record: normalized,
			alreadyExisted: Boolean(existing),
		};
	}

	static async listAll(): Promise<UserRecord[]> {
		const payload = await this.readPayload();
		return toSortedUserRecords(payload.records);
	}

	static async getStatus(): Promise<UserCollectionStoreStatus> {
		const payload = await this.readPayload();
		const provider = await getKVStoreInfo();

		return {
			provider: provider.provider,
			location: provider.location,
			totalUsers: Object.keys(payload.records).length,
			lastUpdatedAt: payload.updatedAt || null,
		};
	}
}
