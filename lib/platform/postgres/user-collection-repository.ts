import "server-only";

import { randomUUID } from "crypto";
import type {
	UserCollectionAnalytics,
	UserCollectionSourceSummary,
	UserRecord,
} from "@/features/auth/types";
import { isValidUserId } from "@/features/auth/user-id";
import { getUserRepository } from "@/lib/platform/postgres/user-repository";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderUserCollectionRepository:
		| UserCollectionRepository
		| undefined;
}

export interface UserCollectionStoreSnapshot {
	users: UserRecord[];
	analytics: UserCollectionAnalytics;
	totalUsers: number;
	lastUpdatedAt: string | null;
}

type RollupRow = {
	user_id: string | null;
	email: string;
	first_name: string;
	last_name: string;
	consent: boolean;
	terms_version: string | null;
	terms_accepted_at: Date | string | null;
	privacy_version: string | null;
	privacy_accepted_at: Date | string | null;
	marketing_consent: boolean | null;
	event_update_consent: boolean | null;
	source: string;
	device_class: string | null;
	platform: string | null;
	browser_family: string | null;
	timezone: string | null;
	locale: string | null;
	first_seen_at: Date | string;
	last_seen_at: Date | string;
	user_last_seen_at: Date | string | null;
	user_last_authenticated_at: Date | string | null;
	updated_at: Date | string;
};

type ContextSummaryRow = {
	label: string;
	users: number;
};

type SignalCounts = {
	linkedSignalCount: number;
	searchSignalCount: number;
	filterSignalCount: number;
	planActionSignalCount: number;
	eventActionSignalCount: number;
	genrePreferenceSignalCount: number;
	lastSignalAt: string | null;
};

const toIsoString = (value: Date | string | null): string | null => {
	if (!value) return null;
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
};

const latestIso = (
	left: string | null | undefined,
	right: string | null | undefined,
): string | null => {
	if (!left) return right ?? null;
	if (!right) return left;
	return left > right ? left : right;
};

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

const normalizeTopSources = (
	rows: Array<{ source: string; users: number; submissions: number }>,
): UserCollectionSourceSummary[] =>
	rows.map((row) => ({
		source: row.source,
		users: row.users,
		submissions: row.submissions,
	}));

const emptySignalCounts = (): SignalCounts => ({
	linkedSignalCount: 0,
	searchSignalCount: 0,
	filterSignalCount: 0,
	planActionSignalCount: 0,
	eventActionSignalCount: 0,
	genrePreferenceSignalCount: 0,
	lastSignalAt: null,
});

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const bumpSignalCounts = (
	counts: Map<string, SignalCounts>,
	email: string,
	key: keyof Omit<SignalCounts, "linkedSignalCount" | "lastSignalAt">,
	count: number,
	lastSeenAt: Date | string | null,
) => {
	const normalizedEmail = normalizeEmail(email);
	const entry = counts.get(normalizedEmail) ?? emptySignalCounts();
	entry[key] += count;
	entry.linkedSignalCount += count;
	const lastSeenIso = toIsoString(lastSeenAt);
	if (
		lastSeenIso &&
		(!entry.lastSignalAt || lastSeenIso > entry.lastSignalAt)
	) {
		entry.lastSignalAt = lastSeenIso;
	}
	counts.set(normalizedEmail, entry);
};

export class UserCollectionRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_collection_events (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				email TEXT NOT NULL,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				consent BOOLEAN NOT NULL,
				source TEXT NOT NULL,
				device_class TEXT,
				platform TEXT,
				browser_family TEXT,
				timezone TEXT,
				locale TEXT,
				submitted_at TIMESTAMPTZ NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_collection_rollup (
				email TEXT PRIMARY KEY,
				user_id TEXT,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				consent BOOLEAN NOT NULL,
				source TEXT NOT NULL,
				device_class TEXT,
				platform TEXT,
				browser_family TEXT,
				timezone TEXT,
				locale TEXT,
				first_seen_at TIMESTAMPTZ NOT NULL,
				last_seen_at TIMESTAMPTZ NOT NULL,
				submission_count INTEGER NOT NULL DEFAULT 1,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			ALTER TABLE app_user_collection_events
			ADD COLUMN IF NOT EXISTS user_id TEXT
		`;

		await this.sql`
			ALTER TABLE app_user_collection_rollup
			ADD COLUMN IF NOT EXISTS user_id TEXT
		`;
		await this
			.sql`ALTER TABLE app_user_collection_events ADD COLUMN IF NOT EXISTS device_class TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_events ADD COLUMN IF NOT EXISTS platform TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_events ADD COLUMN IF NOT EXISTS browser_family TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_events ADD COLUMN IF NOT EXISTS timezone TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_events ADD COLUMN IF NOT EXISTS locale TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_rollup ADD COLUMN IF NOT EXISTS device_class TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_rollup ADD COLUMN IF NOT EXISTS platform TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_rollup ADD COLUMN IF NOT EXISTS browser_family TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_rollup ADD COLUMN IF NOT EXISTS timezone TEXT`;
		await this
			.sql`ALTER TABLE app_user_collection_rollup ADD COLUMN IF NOT EXISTS locale TEXT`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_collection_events_email_submitted
			ON app_user_collection_events (email, submitted_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_collection_events_submitted
			ON app_user_collection_events (submitted_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_collection_events_source_submitted
			ON app_user_collection_events (source, submitted_at DESC)
		`;

		await this.sql`
				CREATE INDEX IF NOT EXISTS idx_app_user_collection_events_user_submitted
				ON app_user_collection_events (user_id, submitted_at DESC)
			`;

		await this.sql`
				CREATE INDEX IF NOT EXISTS idx_app_user_collection_rollup_user
				ON app_user_collection_rollup (user_id)
			`;
	}

	private async ready(): Promise<void> {
		await getUserRepository()?.ensureReady();
		await this.ensureSchemaPromise;
	}

	async addOrUpdate(user: UserRecord): Promise<{
		record: UserRecord;
		alreadyExisted: boolean;
	}> {
		await this.ready();
		const nowIso = user.timestamp || new Date().toISOString();
		const canonicalUser = await getUserRepository()?.upsertFromEmail({
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			source: user.source,
			termsAccepted: user.consent,
			privacyConsent: user.consent,
			marketingConsent: user.marketingConsent ?? false,
			eventUpdateConsent: user.eventUpdateConsent ?? false,
			marketingPreferenceUpdated: user.marketingPreferenceUpdated ?? false,
			deviceClass: user.deviceClass,
			platform: user.platform,
			browserFamily: user.browserFamily,
			timezone: user.timezone,
			locale: user.locale,
			timestamp: nowIso,
		});
		const userId = canonicalUser?.id ?? user.userId ?? null;
		const record = userId ? { ...user, userId } : user;

		await this.sql`
			INSERT INTO app_user_collection_events (
				id,
				user_id,
				email,
				first_name,
				last_name,
				consent,
				source,
				device_class,
				platform,
				browser_family,
				timezone,
				locale,
				submitted_at
			)
			VALUES (
				${randomUUID()},
				${userId},
				${record.email},
				${record.firstName},
				${record.lastName},
				${record.consent},
				${record.source},
				${record.deviceClass ?? null},
				${record.platform ?? null},
				${record.browserFamily ?? null},
				${record.timezone ?? null},
				${record.locale ?? null},
				${nowIso}
			)
		`;

		const upsertRows = await this.sql<{ inserted: boolean }[]>`
			INSERT INTO app_user_collection_rollup (
				email,
				user_id,
				first_name,
				last_name,
				consent,
				source,
				device_class,
				platform,
				browser_family,
				timezone,
				locale,
				first_seen_at,
				last_seen_at,
				submission_count,
				updated_at
			)
			VALUES (
				${record.email},
				${userId},
				${record.firstName},
				${record.lastName},
				${record.consent},
				${record.source},
				${record.deviceClass ?? null},
				${record.platform ?? null},
				${record.browserFamily ?? null},
				${record.timezone ?? null},
				${record.locale ?? null},
				${nowIso},
				${nowIso},
				1,
				NOW()
			)
			ON CONFLICT (email)
			DO UPDATE SET
				user_id = COALESCE(app_user_collection_rollup.user_id, EXCLUDED.user_id),
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				consent = EXCLUDED.consent,
				source = EXCLUDED.source,
				device_class = COALESCE(EXCLUDED.device_class, app_user_collection_rollup.device_class),
				platform = COALESCE(EXCLUDED.platform, app_user_collection_rollup.platform),
				browser_family = COALESCE(EXCLUDED.browser_family, app_user_collection_rollup.browser_family),
				timezone = COALESCE(EXCLUDED.timezone, app_user_collection_rollup.timezone),
				locale = COALESCE(EXCLUDED.locale, app_user_collection_rollup.locale),
				last_seen_at = EXCLUDED.last_seen_at,
				submission_count = app_user_collection_rollup.submission_count + 1,
				updated_at = NOW()
			RETURNING (xmax = 0) AS inserted
		`;

		return {
			record,
			alreadyExisted: !(upsertRows[0]?.inserted ?? false),
		};
	}

	async listAll(limit = 10_000): Promise<UserRecord[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(limit, 20_000));
		const rows = await this.sql<RollupRow[]>`
				SELECT
					COALESCE(r.user_id, u.id) AS user_id,
					r.email,
					r.first_name,
					r.last_name,
					r.consent,
					u.terms_version,
					u.terms_accepted_at,
					u.privacy_version,
					u.privacy_accepted_at,
					u.marketing_consent,
					u.event_update_consent,
					r.source,
					r.device_class,
					r.platform,
					r.browser_family,
					r.timezone,
						r.locale,
						r.first_seen_at,
						r.last_seen_at,
						u.last_seen_at AS user_last_seen_at,
						u.last_authenticated_at AS user_last_authenticated_at,
						r.updated_at
				FROM app_user_collection_rollup r
				LEFT JOIN app_users u ON u.email_normalized = LOWER(r.email)
			ORDER BY r.last_seen_at DESC
			LIMIT ${safeLimit}
		`;
		const signalCounts = await this.listSignalCounts(
			rows.map((row) => ({ email: row.email, userId: row.user_id })),
		);

		return rows.map((row) => {
			const firstVerifiedAt = toIsoString(row.first_seen_at) || undefined;
			const lastVerifiedAt =
				toIsoString(row.last_seen_at) || new Date(0).toISOString();
			const lastSeenAt = latestIso(
				toIsoString(row.user_last_seen_at),
				lastVerifiedAt,
			);
			const lastAuthenticatedAt =
				toIsoString(row.user_last_authenticated_at) || lastVerifiedAt;
			return {
				...(row.user_id ? { userId: row.user_id } : {}),
				firstName: row.first_name,
				lastName: row.last_name,
				email: normalizeEmail(row.email),
				timestamp: lastVerifiedAt,
				firstSignInAt: firstVerifiedAt,
				firstVerifiedAt,
				lastVerifiedAt,
				lastSeenAt,
				lastAuthenticatedAt,
				consent: row.consent,
				termsVersion: row.terms_version,
				termsAcceptedAt: toIsoString(row.terms_accepted_at),
				privacyVersion: row.privacy_version,
				privacyAcceptedAt: toIsoString(row.privacy_accepted_at),
				marketingConsent: Boolean(row.marketing_consent),
				eventUpdateConsent: Boolean(row.event_update_consent),
				source: row.source,
				deviceClass: row.device_class,
				platform: row.platform,
				browserFamily: row.browser_family,
				timezone: row.timezone,
				locale: row.locale,
				...signalCounts.get(normalizeEmail(row.email)),
			};
		});
	}

	async findByEmail(email: string): Promise<UserRecord | null> {
		await this.ready();
		const normalizedEmail = normalizeEmail(email);
		if (!normalizedEmail) return null;

		const rows = await this.sql<RollupRow[]>`
				SELECT
					COALESCE(r.user_id, u.id) AS user_id,
					r.email,
					r.first_name,
					r.last_name,
					r.consent,
					u.terms_version,
					u.terms_accepted_at,
					u.privacy_version,
					u.privacy_accepted_at,
					u.marketing_consent,
					u.event_update_consent,
					r.source,
					r.device_class,
					r.platform,
					r.browser_family,
					r.timezone,
						r.locale,
						r.first_seen_at,
						r.last_seen_at,
						u.last_seen_at AS user_last_seen_at,
						u.last_authenticated_at AS user_last_authenticated_at,
						r.updated_at
				FROM app_user_collection_rollup r
				LEFT JOIN app_users u ON u.email_normalized = r.email
			WHERE r.email = ${normalizedEmail}
			LIMIT 1
		`;
		const row = rows[0];
		if (!row) return null;

		const signalCounts = await this.listSignalCounts([
			{ email: row.email, userId: row.user_id },
		]);
		const firstVerifiedAt = toIsoString(row.first_seen_at) || undefined;
		const lastVerifiedAt =
			toIsoString(row.last_seen_at) || new Date(0).toISOString();
		const lastSeenAt = latestIso(
			toIsoString(row.user_last_seen_at),
			lastVerifiedAt,
		);
		const lastAuthenticatedAt =
			toIsoString(row.user_last_authenticated_at) || lastVerifiedAt;
		return {
			...(row.user_id ? { userId: row.user_id } : {}),
			firstName: row.first_name,
			lastName: row.last_name,
			email: normalizeEmail(row.email),
			timestamp: lastVerifiedAt,
			firstSignInAt: firstVerifiedAt,
			firstVerifiedAt,
			lastVerifiedAt,
			lastSeenAt,
			lastAuthenticatedAt,
			consent: row.consent,
			termsVersion: row.terms_version,
			termsAcceptedAt: toIsoString(row.terms_accepted_at),
			privacyVersion: row.privacy_version,
			privacyAcceptedAt: toIsoString(row.privacy_accepted_at),
			marketingConsent: Boolean(row.marketing_consent),
			eventUpdateConsent: Boolean(row.event_update_consent),
			source: row.source,
			deviceClass: row.device_class,
			platform: row.platform,
			browserFamily: row.browser_family,
			timezone: row.timezone,
			locale: row.locale,
			...signalCounts.get(normalizeEmail(row.email)),
		};
	}

	async findByUserId(userId: string): Promise<UserRecord | null> {
		const normalizedUserId = isValidUserId(userId) ? userId : null;
		if (!normalizedUserId) return null;
		await this.ready();

		const rows = await this.sql<RollupRow[]>`
				SELECT
					COALESCE(r.user_id, u.id) AS user_id,
					r.email,
					r.first_name,
					r.last_name,
					r.consent,
					u.terms_version,
					u.terms_accepted_at,
					u.privacy_version,
					u.privacy_accepted_at,
					u.marketing_consent,
					u.event_update_consent,
					r.source,
					r.device_class,
					r.platform,
					r.browser_family,
					r.timezone,
						r.locale,
						r.first_seen_at,
						r.last_seen_at,
						u.last_seen_at AS user_last_seen_at,
						u.last_authenticated_at AS user_last_authenticated_at,
						r.updated_at
				FROM app_user_collection_rollup r
				LEFT JOIN app_users u ON u.email_normalized = r.email
			WHERE COALESCE(r.user_id, u.id) = ${normalizedUserId}
			LIMIT 1
		`;
		const row = rows[0];
		if (!row) return null;

		const signalCounts = await this.listSignalCounts([
			{ email: row.email, userId: row.user_id },
		]);
		const firstVerifiedAt = toIsoString(row.first_seen_at) || undefined;
		const lastVerifiedAt =
			toIsoString(row.last_seen_at) || new Date(0).toISOString();
		const lastSeenAt = latestIso(
			toIsoString(row.user_last_seen_at),
			lastVerifiedAt,
		);
		const lastAuthenticatedAt =
			toIsoString(row.user_last_authenticated_at) || lastVerifiedAt;
		return {
			...(row.user_id ? { userId: row.user_id } : {}),
			firstName: row.first_name,
			lastName: row.last_name,
			email: normalizeEmail(row.email),
			timestamp: lastVerifiedAt,
			firstSignInAt: firstVerifiedAt,
			firstVerifiedAt,
			lastVerifiedAt,
			lastSeenAt,
			lastAuthenticatedAt,
			consent: row.consent,
			termsVersion: row.terms_version,
			termsAcceptedAt: toIsoString(row.terms_accepted_at),
			privacyVersion: row.privacy_version,
			privacyAcceptedAt: toIsoString(row.privacy_accepted_at),
			marketingConsent: Boolean(row.marketing_consent),
			eventUpdateConsent: Boolean(row.event_update_consent),
			source: row.source,
			deviceClass: row.device_class,
			platform: row.platform,
			browserFamily: row.browser_family,
			timezone: row.timezone,
			locale: row.locale,
			...signalCounts.get(normalizeEmail(row.email)),
		};
	}

	private async listSignalCounts(
		users: Array<{ email: string; userId: string | null }>,
	): Promise<Map<string, SignalCounts>> {
		const normalizedUsers = users.map((user) => ({
			email: normalizeEmail(user.email),
			userId: user.userId,
		}));
		const emails = [...new Set(normalizedUsers.map((user) => user.email))];
		const userIds = [
			...new Set(
				normalizedUsers
					.map((user) => user.userId)
					.filter((userId): userId is string => Boolean(userId)),
			),
		];
		const userIdToEmail = new Map(
			normalizedUsers
				.filter((user): user is { email: string; userId: string } =>
					Boolean(user.userId),
				)
				.map((user) => [user.userId, user.email]),
		);
		const counts = new Map<string, SignalCounts>();
		if (emails.length === 0) return counts;

		const tableRows = await this.sql<
			Array<{
				event_table: string | null;
				discovery_table: string | null;
				genre_table: string | null;
			}>
		>`
			SELECT
				to_regclass('app_event_engagement_stats')::text AS event_table,
				to_regclass('app_discovery_analytics_stats')::text AS discovery_table,
				to_regclass('app_user_genre_preferences')::text AS genre_table
		`;
		const tables = tableRows[0];

		if (tables?.event_table && userIds.length > 0) {
			const rowsByUserId = await this.sql<
				Array<{
					user_id: string;
					count: number;
					last_seen_at: Date | string | null;
				}>
			>`
				SELECT
					stats.user_id,
					COUNT(*)::int AS count,
					MAX(stats.recorded_at) AS last_seen_at
				FROM app_event_engagement_stats stats
				WHERE stats.user_id = ANY(${userIds})
				GROUP BY stats.user_id
			`;
			for (const row of rowsByUserId) {
				const email = userIdToEmail.get(row.user_id);
				if (!email) continue;
				bumpSignalCounts(
					counts,
					email,
					"eventActionSignalCount",
					row.count,
					row.last_seen_at,
				);
			}
		}

		if (tables?.event_table && emails.length > 0) {
			const rowsByEmail =
				userIds.length > 0
					? await this.sql<
							Array<{
								email: string;
								count: number;
								last_seen_at: Date | string | null;
							}>
						>`
							SELECT
								COALESCE(users.email_normalized, LOWER(stats.user_email)) AS email,
								COUNT(*)::int AS count,
								MAX(stats.recorded_at) AS last_seen_at
							FROM app_event_engagement_stats stats
							LEFT JOIN app_users users ON users.id = stats.user_id
							WHERE COALESCE(users.email_normalized, LOWER(stats.user_email)) = ANY(${emails})
								AND (stats.user_id IS NULL OR stats.user_id <> ALL(${userIds}))
							GROUP BY COALESCE(users.email_normalized, LOWER(stats.user_email))
						`
					: await this.sql<
							Array<{
								email: string;
								count: number;
								last_seen_at: Date | string | null;
							}>
						>`
							SELECT
								COALESCE(users.email_normalized, LOWER(stats.user_email)) AS email,
								COUNT(*)::int AS count,
								MAX(stats.recorded_at) AS last_seen_at
							FROM app_event_engagement_stats stats
							LEFT JOIN app_users users ON users.id = stats.user_id
							WHERE COALESCE(users.email_normalized, LOWER(stats.user_email)) = ANY(${emails})
							GROUP BY COALESCE(users.email_normalized, LOWER(stats.user_email))
						`;
			for (const row of rowsByEmail) {
				bumpSignalCounts(
					counts,
					row.email,
					"eventActionSignalCount",
					row.count,
					row.last_seen_at,
				);
			}
		}

		if (tables?.discovery_table && userIds.length > 0) {
			const rowsByUserId = await this.sql<
				Array<{
					user_id: string;
					search_count: number;
					filter_count: number;
					plan_count: number;
					last_seen_at: Date | string | null;
				}>
			>`
				SELECT
					stats.user_id,
					COUNT(*) FILTER (WHERE stats.action_type = 'search')::int AS search_count,
					COUNT(*) FILTER (WHERE stats.action_type = 'filter_apply')::int AS filter_count,
					COUNT(*) FILTER (WHERE stats.action_type = 'plan_action')::int AS plan_count,
					MAX(stats.recorded_at) AS last_seen_at
				FROM app_discovery_analytics_stats stats
				WHERE stats.user_id = ANY(${userIds})
				GROUP BY stats.user_id
			`;
			for (const row of rowsByUserId) {
				const email = userIdToEmail.get(row.user_id);
				if (!email) continue;
				bumpSignalCounts(
					counts,
					email,
					"searchSignalCount",
					row.search_count,
					row.last_seen_at,
				);
				bumpSignalCounts(
					counts,
					email,
					"filterSignalCount",
					row.filter_count,
					row.last_seen_at,
				);
				bumpSignalCounts(
					counts,
					email,
					"planActionSignalCount",
					row.plan_count,
					row.last_seen_at,
				);
			}
		}

		if (tables?.discovery_table && emails.length > 0) {
			const rowsByEmail =
				userIds.length > 0
					? await this.sql<
							Array<{
								email: string;
								search_count: number;
								filter_count: number;
								plan_count: number;
								last_seen_at: Date | string | null;
							}>
						>`
							SELECT
								COALESCE(users.email_normalized, LOWER(stats.user_email)) AS email,
								COUNT(*) FILTER (WHERE stats.action_type = 'search')::int AS search_count,
								COUNT(*) FILTER (WHERE stats.action_type = 'filter_apply')::int AS filter_count,
								COUNT(*) FILTER (WHERE stats.action_type = 'plan_action')::int AS plan_count,
								MAX(stats.recorded_at) AS last_seen_at
							FROM app_discovery_analytics_stats stats
							LEFT JOIN app_users users ON users.id = stats.user_id
							WHERE (
									users.email_normalized = ANY(${emails})
									OR LOWER(stats.user_email) = ANY(${emails})
								)
								AND (stats.user_id IS NULL OR stats.user_id <> ALL(${userIds}))
							GROUP BY COALESCE(users.email_normalized, LOWER(stats.user_email))
						`
					: await this.sql<
							Array<{
								email: string;
								search_count: number;
								filter_count: number;
								plan_count: number;
								last_seen_at: Date | string | null;
							}>
						>`
							SELECT
								COALESCE(users.email_normalized, LOWER(stats.user_email)) AS email,
								COUNT(*) FILTER (WHERE stats.action_type = 'search')::int AS search_count,
								COUNT(*) FILTER (WHERE stats.action_type = 'filter_apply')::int AS filter_count,
								COUNT(*) FILTER (WHERE stats.action_type = 'plan_action')::int AS plan_count,
								MAX(stats.recorded_at) AS last_seen_at
							FROM app_discovery_analytics_stats stats
							LEFT JOIN app_users users ON users.id = stats.user_id
							WHERE users.email_normalized = ANY(${emails})
								OR LOWER(stats.user_email) = ANY(${emails})
							GROUP BY COALESCE(users.email_normalized, LOWER(stats.user_email))
						`;
			for (const row of rowsByEmail) {
				bumpSignalCounts(
					counts,
					row.email,
					"searchSignalCount",
					row.search_count,
					row.last_seen_at,
				);
				bumpSignalCounts(
					counts,
					row.email,
					"filterSignalCount",
					row.filter_count,
					row.last_seen_at,
				);
				bumpSignalCounts(
					counts,
					row.email,
					"planActionSignalCount",
					row.plan_count,
					row.last_seen_at,
				);
			}
		}

		if (tables?.genre_table) {
			const rowsByIdentity =
				userIds.length > 0
					? await this.sql<
							Array<{
								email: string;
								user_id: string | null;
								count: number;
								last_seen_at: Date | string | null;
							}>
						>`
							SELECT
								email,
								user_id,
								COUNT(*)::int AS count,
								MAX(last_seen_at) AS last_seen_at
							FROM app_user_genre_preferences
							WHERE email = ANY(${emails})
								OR user_id = ANY(${userIds})
							GROUP BY email, user_id
						`
					: await this.sql<
							Array<{
								email: string;
								user_id: string | null;
								count: number;
								last_seen_at: Date | string | null;
							}>
						>`
							SELECT
								email,
								user_id,
								COUNT(*)::int AS count,
								MAX(last_seen_at) AS last_seen_at
							FROM app_user_genre_preferences
							WHERE email = ANY(${emails})
							GROUP BY email, user_id
						`;
			for (const row of rowsByIdentity) {
				const email = emails.includes(normalizeEmail(row.email))
					? row.email
					: row.user_id
						? userIdToEmail.get(row.user_id)
						: null;
				if (!email) continue;
				bumpSignalCounts(
					counts,
					email,
					"genrePreferenceSignalCount",
					row.count,
					row.last_seen_at,
				);
			}
		}

		return counts;
	}

	async touchContext(input: {
		userId?: string | null;
		email?: string | null;
		deviceClass?: string | null;
		platform?: string | null;
		browserFamily?: string | null;
		timezone?: string | null;
		locale?: string | null;
	}): Promise<void> {
		await this.ready();
		const userId = isValidUserId(input.userId) ? input.userId : null;
		const email = input.email?.trim().toLowerCase() || null;
		if (!userId && !email) return;

		if (userId) {
			await this.sql`
				UPDATE app_user_collection_rollup
				SET
					device_class = COALESCE(${input.deviceClass ?? null}, device_class),
					platform = COALESCE(${input.platform ?? null}, platform),
					browser_family = COALESCE(${input.browserFamily ?? null}, browser_family),
					timezone = COALESCE(${input.timezone ?? null}, timezone),
					locale = COALESCE(${input.locale ?? null}, locale),
					last_seen_at = NOW(),
					updated_at = NOW()
				WHERE user_id = ${userId}
			`;
			return;
		}

		await this.sql`
			UPDATE app_user_collection_rollup
			SET
				device_class = COALESCE(${input.deviceClass ?? null}, device_class),
				platform = COALESCE(${input.platform ?? null}, platform),
				browser_family = COALESCE(${input.browserFamily ?? null}, browser_family),
				timezone = COALESCE(${input.timezone ?? null}, timezone),
				locale = COALESCE(${input.locale ?? null}, locale),
				last_seen_at = NOW(),
				updated_at = NOW()
			WHERE email = ${email}
		`;
	}

	private async countLinkedBehaviorUsers(): Promise<number> {
		const users = await this.listAll(10_000);
		return users.filter((user) => (user.linkedSignalCount ?? 0) > 0).length;
	}

	async getAnalytics(
		linkedBehaviorUsersOverride?: number,
	): Promise<UserCollectionAnalytics> {
		await this.ready();
		const contextSummaryQuery = (columnName: string) => this.sql<
			ContextSummaryRow[]
		>`
			SELECT
				${this.sql(columnName)} AS label,
				COUNT(*)::int AS users
			FROM app_user_collection_rollup
			WHERE ${this.sql(columnName)} IS NOT NULL
				AND ${this.sql(columnName)} <> ''
			GROUP BY ${this.sql(columnName)}
			ORDER BY users DESC, label ASC
			LIMIT 8
		`;

		const [
			rollupRows,
			recentRows,
			topSourceRows,
			rangeRows,
			topDeviceClasses,
			topPlatforms,
			topBrowserFamilies,
			topTimezones,
			topLocales,
		] = await Promise.all([
			this.sql<
				{
					total_users: number;
					total_submissions: number;
					consented_users: number;
					non_consented_users: number;
				}[]
			>`
				SELECT
					COUNT(*)::int AS total_users,
					COALESCE(SUM(submission_count), 0)::int AS total_submissions,
					COALESCE(SUM(CASE WHEN consent THEN 1 ELSE 0 END), 0)::int AS consented_users,
					COALESCE(SUM(CASE WHEN consent THEN 0 ELSE 1 END), 0)::int AS non_consented_users
				FROM app_user_collection_rollup
			`,
			this.sql<
				{
					submissions_last_24h: number;
					submissions_last_7d: number;
				}[]
			>`
				SELECT
					COALESCE(SUM(CASE WHEN submitted_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0)::int AS submissions_last_24h,
					COALESCE(SUM(CASE WHEN submitted_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END), 0)::int AS submissions_last_7d
				FROM app_user_collection_events
			`,
			this.sql<
				{
					source: string;
					users: number;
					submissions: number;
				}[]
			>`
				SELECT
					source,
					COUNT(DISTINCT email)::int AS users,
					COUNT(*)::int AS submissions
				FROM app_user_collection_events
				GROUP BY source
				ORDER BY users DESC, submissions DESC
			`,
			this.sql<
				{
					first_captured_at: Date | string | null;
					last_captured_at: Date | string | null;
				}[]
			>`
				SELECT
					MIN(submitted_at) AS first_captured_at,
					MAX(submitted_at) AS last_captured_at
				FROM app_user_collection_events
			`,
			contextSummaryQuery("device_class"),
			contextSummaryQuery("platform"),
			contextSummaryQuery("browser_family"),
			contextSummaryQuery("timezone"),
			contextSummaryQuery("locale"),
		]);

		const totals = rollupRows[0];
		if (!totals) {
			return emptyAnalytics();
		}
		const recent = recentRows[0];
		const capturedRange = rangeRows[0];
		const linkedBehaviorUsers =
			linkedBehaviorUsersOverride ?? (await this.countLinkedBehaviorUsers());

		return {
			totalUsers: totals.total_users,
			totalSubmissions: totals.total_submissions,
			consentedUsers: totals.consented_users,
			nonConsentedUsers: totals.non_consented_users,
			submissionsLast24Hours: recent?.submissions_last_24h ?? 0,
			submissionsLast7Days: recent?.submissions_last_7d ?? 0,
			linkedBehaviorUsers,
			uniqueSources: topSourceRows.length,
			topSources: normalizeTopSources(topSourceRows),
			topDeviceClasses,
			topPlatforms,
			topBrowserFamilies,
			topTimezones,
			topLocales,
			firstCapturedAt: toIsoString(capturedRange?.first_captured_at ?? null),
			lastCapturedAt: toIsoString(capturedRange?.last_captured_at ?? null),
		};
	}

	async getSnapshot(): Promise<UserCollectionStoreSnapshot> {
		await this.ready();
		const [users, statusRow] = await Promise.all([
			this.listAll(),
			this.sql<{ last_updated_at: Date | string | null }[]>`
				SELECT MAX(updated_at) AS last_updated_at
				FROM app_user_collection_rollup
			`,
		]);
		const analytics = await this.getAnalytics(
			users.filter((user) => (user.linkedSignalCount ?? 0) > 0).length,
		);

		return {
			users,
			analytics,
			totalUsers: analytics.totalUsers,
			lastUpdatedAt: toIsoString(statusRow[0]?.last_updated_at ?? null),
		};
	}

	async clearAll(): Promise<void> {
		await this.ready();
		await this.sql`DELETE FROM app_user_collection_events`;
		await this.sql`DELETE FROM app_user_collection_rollup`;
	}

	async deleteByEmails(emails: string[]): Promise<number> {
		await this.ready();
		const normalizedEmails = Array.from(
			new Set(
				emails
					.map((email) => email.trim().toLowerCase())
					.filter((email) => email.length > 0),
			),
		);
		if (normalizedEmails.length === 0) return 0;

		const deletedRows = await this.sql<{ email: string }[]>`
			DELETE FROM app_user_collection_rollup
			WHERE email = ANY(${normalizedEmails})
			RETURNING email
		`;
		await this.sql`
			DELETE FROM app_user_collection_events
			WHERE email = ANY(${normalizedEmails})
		`;

		return deletedRows.length;
	}
}

export const getUserCollectionRepository =
	(): UserCollectionRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (
			!globalThis.__ooocFeteFinderUserCollectionRepository ||
			typeof globalThis.__ooocFeteFinderUserCollectionRepository.findByEmail !==
				"function"
		) {
			globalThis.__ooocFeteFinderUserCollectionRepository =
				new UserCollectionRepository(sql);
		}

		return globalThis.__ooocFeteFinderUserCollectionRepository;
	};
