import "server-only";

import { randomUUID } from "crypto";
import type {
	UserCollectionAnalytics,
	UserCollectionSourceSummary,
	UserRecord,
} from "@/features/auth/types";
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
	email: string;
	first_name: string;
	last_name: string;
	consent: boolean;
	source: string;
	last_seen_at: Date | string;
	updated_at: Date | string;
};

const toIsoString = (value: Date | string | null): string | null => {
	if (!value) return null;
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
};

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

const normalizeTopSources = (
	rows: Array<{ source: string; users: number; submissions: number }>,
): UserCollectionSourceSummary[] =>
	rows.map((row) => ({
		source: row.source,
		users: row.users,
		submissions: row.submissions,
	}));

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
				email TEXT NOT NULL,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				consent BOOLEAN NOT NULL,
				source TEXT NOT NULL,
				submitted_at TIMESTAMPTZ NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_collection_rollup (
				email TEXT PRIMARY KEY,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				consent BOOLEAN NOT NULL,
				source TEXT NOT NULL,
				first_seen_at TIMESTAMPTZ NOT NULL,
				last_seen_at TIMESTAMPTZ NOT NULL,
				submission_count INTEGER NOT NULL DEFAULT 1,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

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
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async addOrUpdate(user: UserRecord): Promise<{
		record: UserRecord;
		alreadyExisted: boolean;
	}> {
		await this.ready();
		const nowIso = user.timestamp || new Date().toISOString();
		await this.sql`
			INSERT INTO app_user_collection_events (
				id,
				email,
				first_name,
				last_name,
				consent,
				source,
				submitted_at
			)
			VALUES (
				${randomUUID()},
				${user.email},
				${user.firstName},
				${user.lastName},
				${user.consent},
				${user.source},
				${nowIso}
			)
		`;

		const upsertRows = await this.sql<{ inserted: boolean }[]>`
			INSERT INTO app_user_collection_rollup (
				email,
				first_name,
				last_name,
				consent,
				source,
				first_seen_at,
				last_seen_at,
				submission_count,
				updated_at
			)
			VALUES (
				${user.email},
				${user.firstName},
				${user.lastName},
				${user.consent},
				${user.source},
				${nowIso},
				${nowIso},
				1,
				NOW()
			)
			ON CONFLICT (email)
			DO UPDATE SET
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				consent = EXCLUDED.consent,
				source = EXCLUDED.source,
				last_seen_at = EXCLUDED.last_seen_at,
				submission_count = app_user_collection_rollup.submission_count + 1,
				updated_at = NOW()
			RETURNING (xmax = 0) AS inserted
		`;

		return {
			record: user,
			alreadyExisted: !(upsertRows[0]?.inserted ?? false),
		};
	}

	async listAll(limit = 10_000): Promise<UserRecord[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(limit, 20_000));
		const rows = await this.sql<RollupRow[]>`
			SELECT
				email,
				first_name,
				last_name,
				consent,
				source,
				last_seen_at,
				updated_at
			FROM app_user_collection_rollup
			ORDER BY last_seen_at DESC
			LIMIT ${safeLimit}
		`;

		return rows.map((row) => ({
			firstName: row.first_name,
			lastName: row.last_name,
			email: row.email,
			timestamp: toIsoString(row.last_seen_at) || new Date(0).toISOString(),
			consent: row.consent,
			source: row.source,
		}));
	}

	async getAnalytics(): Promise<UserCollectionAnalytics> {
		await this.ready();
		const [rollupRows, recentRows, topSourceRows, rangeRows] =
			await Promise.all([
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
			]);

		const totals = rollupRows[0];
		if (!totals) {
			return emptyAnalytics();
		}
		const recent = recentRows[0];
		const capturedRange = rangeRows[0];

		return {
			totalUsers: totals.total_users,
			totalSubmissions: totals.total_submissions,
			consentedUsers: totals.consented_users,
			nonConsentedUsers: totals.non_consented_users,
			submissionsLast24Hours: recent?.submissions_last_24h ?? 0,
			submissionsLast7Days: recent?.submissions_last_7d ?? 0,
			uniqueSources: topSourceRows.length,
			topSources: normalizeTopSources(topSourceRows),
			firstCapturedAt: toIsoString(capturedRange?.first_captured_at ?? null),
			lastCapturedAt: toIsoString(capturedRange?.last_captured_at ?? null),
		};
	}

	async getSnapshot(): Promise<UserCollectionStoreSnapshot> {
		await this.ready();
		const [users, analytics, statusRow] = await Promise.all([
			this.listAll(),
			this.getAnalytics(),
			this.sql<{ last_updated_at: Date | string | null }[]>`
				SELECT MAX(updated_at) AS last_updated_at
				FROM app_user_collection_rollup
			`,
		]);

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
}

export const getUserCollectionRepository =
	(): UserCollectionRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (!globalThis.__ooocFeteFinderUserCollectionRepository) {
			globalThis.__ooocFeteFinderUserCollectionRepository =
				new UserCollectionRepository(sql);
		}

		return globalThis.__ooocFeteFinderUserCollectionRepository;
	};
