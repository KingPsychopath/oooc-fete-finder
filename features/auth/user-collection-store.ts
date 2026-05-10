import "server-only";

import type {
	CollectedUserProfile,
	UserCollectionAnalytics,
	UserRecord,
} from "@/features/auth/types";
import { generateUserId, isValidUserId } from "@/features/auth/user-id";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { getDiscoveryAnalyticsRepository } from "@/lib/platform/postgres/discovery-analytics-repository";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import {
	type UserCollectionStoreSnapshot,
	getUserCollectionRepository,
} from "@/lib/platform/postgres/user-collection-repository";
import { getUserGenrePreferenceRepository } from "@/lib/platform/postgres/user-genre-preference-repository";

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
	linkedBehaviorUsers: 0,
	uniqueSources: 0,
	topSources: [],
	topDeviceClasses: [],
	topPlatforms: [],
	topBrowserFamilies: [],
	topTimezones: [],
	topLocales: [],
	firstCapturedAt: null,
	lastCapturedAt: null,
});

const normalizeUserRecord = (user: UserRecord): UserRecord => ({
	...(isValidUserId(user.userId) ? { userId: user.userId } : {}),
	firstName: user.firstName.trim(),
	lastName: user.lastName.trim(),
	email: user.email.trim().toLowerCase(),
	timestamp: user.timestamp || new Date().toISOString(),
	consent: Boolean(user.consent),
	source: user.source.trim() || "fete-finder-auth",
	deviceClass: user.deviceClass ?? null,
	platform: user.platform ?? null,
	browserFamily: user.browserFamily ?? null,
	timezone: user.timezone ?? null,
	locale: user.locale ?? null,
});

const toSortedUserRecords = (
	records: Record<string, StoredUserRecord>,
): UserRecord[] => {
	return Object.values(records)
		.sort(
			(left, right) =>
				new Date(right.timestamp).getTime() -
				new Date(left.timestamp).getTime(),
		)
		.map((record) => ({
			userId: record.userId,
			firstName: record.firstName,
			lastName: record.lastName,
			email: record.email,
			timestamp: record.timestamp,
			firstSignInAt: record.firstSeenAt,
			consent: record.consent,
			source: record.source,
			deviceClass: record.deviceClass,
			platform: record.platform,
			browserFamily: record.browserFamily,
			timezone: record.timezone,
			locale: record.locale,
		}));
};

const maxCount = (stored: number | undefined, computed: number): number =>
	Math.max(stored ?? 0, computed);

const latestIso = (
	left: string | null | undefined,
	right: string | null | undefined,
): string | null => {
	if (!left) return right ?? null;
	if (!right) return left;
	return left > right ? left : right;
};

const parseTourInteraction = (value: string | null | undefined): {
	action: string;
	stepId: string | null;
	source: string | null;
} | null => {
	const normalized = value?.trim();
	if (!normalized) return null;
	const [action, stepId, source] = normalized
		.split(":", 3)
		.map((segment) => segment.trim());
	if (!action) return null;
	return {
		action,
		stepId: stepId || null,
		source: source || null,
	};
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
	const sources = new Map<
		string,
		{ source: string; users: number; submissions: number }
	>();
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
	const summarizeContext = (
		getValue: (record: StoredUserRecord) => string | null | undefined,
	) =>
		Array.from(
			values.reduce<Map<string, number>>((summary, record) => {
				const value = getValue(record)?.trim();
				if (!value) return summary;
				summary.set(value, (summary.get(value) ?? 0) + 1);
				return summary;
			}, new Map()),
		)
			.map(([label, users]) => ({ label, users }))
			.sort(
				(left, right) =>
					right.users - left.users || left.label.localeCompare(right.label),
			);

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
			linkedBehaviorUsers: 0,
			uniqueSources: sources.size,
			topSources: Array.from(sources.values()).sort((left, right) => {
				if (right.users !== left.users) {
					return right.users - left.users;
				}
				return right.submissions - left.submissions;
			}),
			topDeviceClasses: summarizeContext((record) => record.deviceClass),
			topPlatforms: summarizeContext((record) => record.platform),
			topBrowserFamilies: summarizeContext((record) => record.browserFamily),
			topTimezones: summarizeContext((record) => record.timezone),
			topLocales: summarizeContext((record) => record.locale),
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
		const storedRecord: StoredUserRecord = {
			...normalized,
			userId: existing?.userId ?? normalized.userId ?? generateUserId(),
			submissions: (existing?.submissions ?? 0) + 1,
			firstSeenAt: existing?.firstSeenAt ?? normalized.timestamp,
		};
		store[normalized.email] = storedRecord;

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
			record: {
				userId: storedRecord.userId,
				firstName: storedRecord.firstName,
				lastName: storedRecord.lastName,
				email: storedRecord.email,
				timestamp: storedRecord.timestamp,
				firstSignInAt: storedRecord.firstSeenAt,
				consent: storedRecord.consent,
				source: storedRecord.source,
				deviceClass: storedRecord.deviceClass,
				platform: storedRecord.platform,
				browserFamily: storedRecord.browserFamily,
				timezone: storedRecord.timezone,
				locale: storedRecord.locale,
			},
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

	static async getUserProfile(
		email: string,
	): Promise<CollectedUserProfile | null> {
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail) return null;

		const repository = getUserCollectionRepository();
		const user = repository?.findByEmail
			? await repository.findByEmail(normalizedEmail)
			: (await this.listAll()).find(
					(record) => record.email === normalizedEmail,
				);
		if (!user) return null;

		const discoveryRepository = getDiscoveryAnalyticsRepository();
		const eventRepository = getEventEngagementRepository();

		const [primaryDiscovery, primaryEventActions] = await Promise.all([
			discoveryRepository?.listRecentForUser({
				userId: user.userId,
				limit: 24,
			}) ?? Promise.resolve([]),
			eventRepository?.listRecentForUser({
				userId: user.userId,
				limit: 16,
			}) ?? Promise.resolve([]),
		]);

		const [recentDiscovery, recentEventActions] = await Promise.all([
			primaryDiscovery.length > 0 || !user.userId
				? Promise.resolve(primaryDiscovery)
				: discoveryRepository?.listRecentForUser({
						email: user.email,
						limit: 24,
					}) ?? Promise.resolve([]),
			primaryEventActions.length > 0 || !user.userId
				? Promise.resolve(primaryEventActions)
				: eventRepository?.listRecentForUser({
					email: user.email,
					limit: 16,
				}) ?? Promise.resolve([]),
		]);
		const genrePreferences =
			(await getUserGenrePreferenceRepository()?.listForUser({
				email: user.email,
				userId: user.userId,
				limit: 8,
			})) ?? [];
		const eventsByKey = new Map<
			string,
			{ eventKey: string; name: string; slug: string }
		>();
		if (recentEventActions.length > 0) {
			const liveEventsResult = await getLiveEvents({
				includeFeaturedProjection: false,
				includeEngagementProjection: false,
			});
			for (const event of liveEventsResult.success
				? liveEventsResult.data
				: []) {
				eventsByKey.set(event.eventKey, event);
			}
		}
		const enrichedEventActions = recentEventActions.map((action) => {
			const event = eventsByKey.get(action.eventKey);
			return {
				...action,
				eventName: event?.name ?? null,
				eventHref: event
					? `/event/${encodeURIComponent(event.eventKey)}/${encodeURIComponent(event.slug)}`
					: null,
			};
		});
		const activityCounts = {
			searchSignalCount: recentDiscovery.filter(
				(record) => record.actionType === "search" && record.searchQuery,
			).length,
			filterSignalCount: recentDiscovery.filter(
				(record) =>
					record.actionType === "filter_apply" &&
					record.filterGroup &&
					record.filterValue,
			).length,
			tourSignalCount: recentDiscovery.filter(
				(record) =>
					record.actionType === "tour_interaction" &&
					record.filterGroup === "tour" &&
					record.filterValue,
			).length,
			eventActionSignalCount: recentEventActions.length,
			genrePreferenceSignalCount: genrePreferences.length,
		};
		const linkedSignalCount =
			activityCounts.searchSignalCount +
			activityCounts.filterSignalCount +
			activityCounts.tourSignalCount +
			activityCounts.eventActionSignalCount +
			activityCounts.genrePreferenceSignalCount;
		const lastSignalAt =
			[
				...genrePreferences.map((item) => item.lastSeenAt),
				...recentDiscovery.map((item) => item.recordedAt),
				...recentEventActions.map((item) => item.recordedAt),
			].sort((left, right) => right.localeCompare(left))[0] ?? null;

		return {
			user: {
				...user,
				linkedSignalCount: maxCount(user.linkedSignalCount, linkedSignalCount),
				searchSignalCount: maxCount(
					user.searchSignalCount,
					activityCounts.searchSignalCount,
				),
				filterSignalCount: maxCount(
					user.filterSignalCount,
					activityCounts.filterSignalCount,
				),
				eventActionSignalCount: maxCount(
					user.eventActionSignalCount,
					activityCounts.eventActionSignalCount,
				),
				genrePreferenceSignalCount: maxCount(
					user.genrePreferenceSignalCount,
					activityCounts.genrePreferenceSignalCount,
				),
				lastSignalAt: latestIso(user.lastSignalAt, lastSignalAt),
			},
			genrePreferences,
			recentSearches: recentDiscovery
				.filter(
					(record) => record.actionType === "search" && record.searchQuery,
				)
				.map((record) => ({
					query: record.searchQuery ?? "",
					recordedAt: record.recordedAt,
				}))
				.slice(0, 8),
			recentFilters: recentDiscovery
				.filter(
					(record) =>
						record.actionType === "filter_apply" &&
						record.filterGroup &&
						record.filterValue,
				)
				.map((record) => ({
					filterGroup: record.filterGroup ?? "",
					filterValue: record.filterValue ?? "",
					recordedAt: record.recordedAt,
				}))
				.slice(0, 8),
			recentTourInteractions: recentDiscovery
				.filter(
					(record) =>
						record.actionType === "tour_interaction" && record.filterGroup === "tour",
				)
				.map((record) => {
					const parsed = parseTourInteraction(record.filterValue);
					return {
						action: parsed?.action ?? "tour_interaction",
						stepId: parsed?.stepId ?? null,
						source: parsed?.source ?? null,
						recordedAt: record.recordedAt,
					};
				})
				.slice(0, 8),
			recentEventActions: enrichedEventActions,
		};
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
					location:
						"Postgres tables app_users + app_user_collection_events + app_user_collection_rollup",
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

	static async deleteByEmails(emails: string[]): Promise<number> {
		const normalizedEmails = Array.from(
			new Set(
				emails
					.map((email) => email.trim().toLowerCase())
					.filter((email) => email.length > 0),
			),
		);
		if (normalizedEmails.length === 0) return 0;

		const repository = getUserCollectionRepository();
		if (repository) {
			return repository.deleteByEmails(normalizedEmails);
		}

		const store = getMemoryStore();
		let deletedCount = 0;
		for (const email of normalizedEmails) {
			if (store[email]) {
				delete store[email];
				deletedCount += 1;
			}
		}
		return deletedCount;
	}
}
