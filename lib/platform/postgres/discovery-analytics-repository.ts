import "server-only";

import { isValidUserId } from "@/features/auth/user-id";
import { getUserRepository } from "@/lib/platform/postgres/user-repository";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderDiscoveryAnalyticsRepository:
		| DiscoveryAnalyticsRepository
		| undefined;
}

export type DiscoveryActionType =
	| "search"
	| "filter_apply"
	| "filter_clear"
	| "map_interaction"
	| "sort_change"
	| "location_request"
	| "tour_interaction"
	| "nav_click";

export interface DiscoveryAnalyticsRecordInput {
	actionType: DiscoveryActionType;
	sessionId?: string | null;
	userId?: string | null;
	userEmail?: string | null;
	filterGroup?: string | null;
	filterValue?: string | null;
	searchQuery?: string | null;
	path?: string | null;
	isAuthenticated?: boolean | null;
	deviceClass?: string | null;
	platform?: string | null;
	browserFamily?: string | null;
	timezone?: string | null;
	locale?: string | null;
	recordedAt?: string;
}

type DiscoveryUserMatchRow = {
	email: string;
	hitCount: number;
	lastSeenAt: Date | string;
};

const cleanString = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed.slice(0, maxLength);
};

const sanitizeUserId = (userId: string | null | undefined): string | null => {
	const cleaned = cleanString(userId, 80);
	return cleaned && isValidUserId(cleaned) ? cleaned : null;
};

const toSafeIsoTimestamp = (value?: string): string => {
	if (!value) return new Date().toISOString();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
	return parsed.toISOString();
};

export class DiscoveryAnalyticsRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_discovery_analytics_stats (
				id BIGSERIAL PRIMARY KEY,
				action_type TEXT NOT NULL CHECK (action_type IN ('search', 'filter_apply', 'filter_clear', 'map_interaction', 'sort_change', 'location_request', 'tour_interaction', 'nav_click')),
				session_id TEXT,
				user_id TEXT,
				user_email TEXT,
				filter_group TEXT,
				filter_value TEXT,
				search_query TEXT,
				path TEXT,
				is_authenticated BOOLEAN,
				device_class TEXT,
				platform TEXT,
				browser_family TEXT,
				timezone TEXT,
				locale TEXT,
				recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			DO $$
			BEGIN
				ALTER TABLE app_discovery_analytics_stats
				DROP CONSTRAINT IF EXISTS app_discovery_analytics_stats_action_type_check;
				ALTER TABLE app_discovery_analytics_stats
				ADD CONSTRAINT app_discovery_analytics_stats_action_type_check
				CHECK (action_type IN ('search', 'filter_apply', 'filter_clear', 'map_interaction', 'sort_change', 'location_request', 'tour_interaction', 'nav_click'));
			END $$;
		`;

		await this.sql`
			ALTER TABLE app_discovery_analytics_stats
			ADD COLUMN IF NOT EXISTS user_id TEXT
		`;
		await this
			.sql`ALTER TABLE app_discovery_analytics_stats ADD COLUMN IF NOT EXISTS device_class TEXT`;
		await this
			.sql`ALTER TABLE app_discovery_analytics_stats ADD COLUMN IF NOT EXISTS platform TEXT`;
		await this
			.sql`ALTER TABLE app_discovery_analytics_stats ADD COLUMN IF NOT EXISTS browser_family TEXT`;
		await this
			.sql`ALTER TABLE app_discovery_analytics_stats ADD COLUMN IF NOT EXISTS timezone TEXT`;
		await this
			.sql`ALTER TABLE app_discovery_analytics_stats ADD COLUMN IF NOT EXISTS locale TEXT`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_discovery_analytics_time
			ON app_discovery_analytics_stats (recorded_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_discovery_analytics_action_time
			ON app_discovery_analytics_stats (action_type, recorded_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_discovery_analytics_filter
			ON app_discovery_analytics_stats (filter_group, filter_value, recorded_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_discovery_analytics_search
			ON app_discovery_analytics_stats (search_query, recorded_at DESC)
		`;
		await this.sql`
				CREATE INDEX IF NOT EXISTS idx_app_discovery_analytics_user_time
				ON app_discovery_analytics_stats (user_id, recorded_at DESC)
			`;
		await this.sql`
				CREATE INDEX IF NOT EXISTS idx_app_discovery_analytics_user_email_time
				ON app_discovery_analytics_stats (LOWER(user_email), recorded_at DESC)
			`;
	}

	private async ready(): Promise<void> {
		await getUserRepository()?.ensureReady();
		await this.ensureTablePromise;
	}

	async recordAction(input: DiscoveryAnalyticsRecordInput): Promise<void> {
		await this.ready();
		const userId = sanitizeUserId(input.userId);
		await this.sql`
			INSERT INTO app_discovery_analytics_stats (
				action_type,
				session_id,
				user_id,
				user_email,
				filter_group,
				filter_value,
				search_query,
				path,
				is_authenticated,
				device_class,
				platform,
				browser_family,
				timezone,
				locale,
				recorded_at
			)
			VALUES (
				${input.actionType},
				${cleanString(input.sessionId, 120)},
				${userId},
				${cleanString(input.userEmail, 254)},
				${cleanString(input.filterGroup, 80)},
				${cleanString(input.filterValue, 120)},
				${cleanString(input.searchQuery, 280)},
				${cleanString(input.path, 280)},
				${input.isAuthenticated ?? null},
				${cleanString(input.deviceClass, 40)},
				${cleanString(input.platform, 40)},
				${cleanString(input.browserFamily, 40)},
				${cleanString(input.timezone, 80)},
				${cleanString(input.locale, 40)},
				${toSafeIsoTimestamp(input.recordedAt)}
			)
		`;
	}

	async attachUserToSession(input: {
		sessionId: string;
		userId: string;
		userEmail?: string | null;
		deviceClass?: string | null;
		platform?: string | null;
		browserFamily?: string | null;
		timezone?: string | null;
		locale?: string | null;
		windowDays?: number;
	}): Promise<number> {
		await this.ready();
		const sessionId = cleanString(input.sessionId, 120);
		const userId = sanitizeUserId(input.userId);
		if (!sessionId || !userId) return 0;
		const windowDays = Math.max(1, Math.min(input.windowDays ?? 30, 90));
		const rows = await this.sql<Array<{ id: number }>>`
			UPDATE app_discovery_analytics_stats
			SET
				user_id = COALESCE(user_id, ${userId}),
				user_email = COALESCE(user_email, ${cleanString(input.userEmail, 254)}),
				device_class = COALESCE(device_class, ${cleanString(input.deviceClass, 40)}),
				platform = COALESCE(platform, ${cleanString(input.platform, 40)}),
				browser_family = COALESCE(browser_family, ${cleanString(input.browserFamily, 40)}),
				timezone = COALESCE(timezone, ${cleanString(input.timezone, 80)}),
				locale = COALESCE(locale, ${cleanString(input.locale, 40)})
			WHERE session_id = ${sessionId}
				AND user_id IS NULL
				AND recorded_at >= NOW() - (${windowDays} * INTERVAL '1 day')
			RETURNING id
		`;
		return rows.length;
	}

	async summarizeWindow(input: {
		startAt: string;
		endAt: string;
		includeAuthenticatedOnly?: boolean;
	}): Promise<{
		searchCount: number;
		filterApplyCount: number;
		filterClearCount: number;
		mapInteractionCount: number;
		sortChangeCount: number;
		locationRequestCount: number;
		tourInteractionCount: number;
		navClickCount: number;
		uniqueSessionCount: number;
	}> {
		await this.ready();
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		const rows = await this.sql<
			Array<{
				searchCount: number;
				filterApplyCount: number;
				filterClearCount: number;
				mapInteractionCount: number;
				sortChangeCount: number;
				locationRequestCount: number;
				tourInteractionCount: number;
				navClickCount: number;
				uniqueSessionCount: number;
			}>
		>`
			SELECT
				COUNT(*) FILTER (WHERE action_type = 'search')::int AS "searchCount",
				COUNT(*) FILTER (WHERE action_type = 'filter_apply')::int AS "filterApplyCount",
				COUNT(*) FILTER (WHERE action_type = 'filter_clear')::int AS "filterClearCount",
				COUNT(*) FILTER (WHERE action_type = 'map_interaction')::int AS "mapInteractionCount",
				COUNT(*) FILTER (WHERE action_type = 'sort_change')::int AS "sortChangeCount",
				COUNT(*) FILTER (WHERE action_type = 'location_request')::int AS "locationRequestCount",
				COUNT(*) FILTER (WHERE action_type = 'tour_interaction')::int AS "tourInteractionCount",
				COUNT(*) FILTER (WHERE action_type = 'nav_click')::int AS "navClickCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount"
			FROM app_discovery_analytics_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
		`;
		return (
			rows[0] ?? {
				searchCount: 0,
				filterApplyCount: 0,
				filterClearCount: 0,
				mapInteractionCount: 0,
				sortChangeCount: 0,
				locationRequestCount: 0,
				tourInteractionCount: 0,
				navClickCount: 0,
				uniqueSessionCount: 0,
			}
		);
	}

	async listTopDiscoveryActions(input: {
		actionType: DiscoveryActionType;
		startAt: string;
		endAt: string;
		limit: number;
		includeAuthenticatedOnly?: boolean;
	}): Promise<Array<{ group: string; value: string; count: number }>> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		const rows = await this.sql<
			Array<{ group: string; value: string; count: number }>
		>`
			SELECT
				COALESCE(filter_group, 'unknown') AS "group",
				COALESCE(filter_value, 'unknown') AS value,
				COUNT(*)::int AS count
			FROM app_discovery_analytics_stats
			WHERE action_type = ${input.actionType}
				AND recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
			GROUP BY 1, 2
			ORDER BY count DESC
			LIMIT ${safeLimit}
		`;
		return rows;
	}

	async listTopFilters(input: {
		startAt: string;
		endAt: string;
		limit: number;
		includeAuthenticatedOnly?: boolean;
	}): Promise<
		Array<{ filterGroup: string; filterValue: string; count: number }>
	> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		const rows = await this.sql<
			Array<{ filterGroup: string; filterValue: string; count: number }>
		>`
			SELECT
				COALESCE(filter_group, 'unknown') AS "filterGroup",
				COALESCE(filter_value, 'unknown') AS "filterValue",
				COUNT(*)::int AS count
			FROM app_discovery_analytics_stats
			WHERE action_type = 'filter_apply'
				AND recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
			GROUP BY 1, 2
			ORDER BY count DESC
			LIMIT ${safeLimit}
		`;
		return rows;
	}

	async listTopSearches(input: {
		startAt: string;
		endAt: string;
		limit: number;
		includeAuthenticatedOnly?: boolean;
	}): Promise<Array<{ query: string; count: number }>> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		const rows = await this.sql<Array<{ query: string; count: number }>>`
			SELECT
				search_query AS query,
				COUNT(*)::int AS count
			FROM app_discovery_analytics_stats
			WHERE action_type = 'search'
				AND search_query IS NOT NULL
				AND search_query <> ''
				AND recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
			GROUP BY search_query
			ORDER BY count DESC
			LIMIT ${safeLimit}
		`;
		return rows;
	}

	async listTopSearchSignals(input: {
		startAt: string;
		endAt: string;
		recentStartAt: string;
		limit: number;
		excludeSearchSource?: string;
	}): Promise<
		Array<{
			query: string;
			count: number;
			recentCount: number;
			lastSeenAt: string;
		}>
	> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 250));
		const excludedSearchSource = cleanString(input.excludeSearchSource, 120);
		const sourceFilter = excludedSearchSource
			? this
					.sql`AND NOT (filter_group = 'search_source' AND filter_value = ${excludedSearchSource})`
			: this.sql``;
		const rows = await this.sql<
			Array<{
				query: string;
				count: number;
				recentCount: number;
				lastSeenAt: Date | string;
			}>
		>`
			SELECT
				search_query AS query,
				COUNT(*)::int AS count,
				COUNT(*) FILTER (WHERE recorded_at >= ${input.recentStartAt})::int AS "recentCount",
				MAX(recorded_at) AS "lastSeenAt"
			FROM app_discovery_analytics_stats
			WHERE action_type = 'search'
				AND search_query IS NOT NULL
				AND search_query <> ''
				AND recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${sourceFilter}
			GROUP BY search_query
			ORDER BY count DESC, "recentCount" DESC, MAX(recorded_at) DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			query: row.query,
			count: row.count,
			recentCount: row.recentCount,
			lastSeenAt:
				row.lastSeenAt instanceof Date
					? row.lastSeenAt.toISOString()
					: new Date(row.lastSeenAt).toISOString(),
		}));
	}

	async listUserFilterMatches(input: {
		startAt: string;
		endAt: string;
		filterGroup: string;
		filterValue: string;
		minHits: number;
		limit: number;
	}): Promise<Array<{ email: string; hitCount: number; lastSeenAt: string }>> {
		await this.ready();
		const filterGroup = cleanString(input.filterGroup, 80);
		const filterValue = cleanString(input.filterValue, 120);
		if (!filterGroup || !filterValue) {
			return [];
		}

		const safeLimit = Math.max(1, Math.min(input.limit, 20_000));
		const safeMinHits = Math.max(1, Math.min(input.minHits, 200));

		const rows = await this.sql<DiscoveryUserMatchRow[]>`
			SELECT
				COALESCE(users.email_normalized, LOWER(stats.user_email)) AS email,
				COUNT(*)::int AS "hitCount",
				MAX(stats.recorded_at) AS "lastSeenAt"
			FROM app_discovery_analytics_stats stats
			LEFT JOIN app_users users ON users.id = stats.user_id
			WHERE stats.action_type = 'filter_apply'
				AND stats.filter_group = ${filterGroup}
				AND stats.filter_value = ${filterValue}
				AND stats.recorded_at >= ${input.startAt}
				AND stats.recorded_at < ${input.endAt}
				AND COALESCE(users.email_normalized, LOWER(stats.user_email)) IS NOT NULL
			GROUP BY COALESCE(users.email_normalized, LOWER(stats.user_email))
			HAVING COUNT(*) >= ${safeMinHits}
			ORDER BY "hitCount" DESC, MAX(stats.recorded_at) DESC
			LIMIT ${safeLimit}
		`;

		return rows.map((row) => ({
			email: row.email,
			hitCount: row.hitCount,
			lastSeenAt:
				row.lastSeenAt instanceof Date
					? row.lastSeenAt.toISOString()
					: new Date(row.lastSeenAt).toISOString(),
		}));
	}

	async listUserSearchMatches(input: {
		startAt: string;
		endAt: string;
		searchContains: string;
		minHits: number;
		limit: number;
	}): Promise<Array<{ email: string; hitCount: number; lastSeenAt: string }>> {
		await this.ready();
		const searchContains = cleanString(input.searchContains, 160);
		if (!searchContains) {
			return [];
		}

		const safeLimit = Math.max(1, Math.min(input.limit, 20_000));
		const safeMinHits = Math.max(1, Math.min(input.minHits, 200));
		const searchLike = `%${searchContains.toLowerCase()}%`;

		const rows = await this.sql<DiscoveryUserMatchRow[]>`
			SELECT
				COALESCE(users.email_normalized, LOWER(stats.user_email)) AS email,
				COUNT(*)::int AS "hitCount",
				MAX(stats.recorded_at) AS "lastSeenAt"
			FROM app_discovery_analytics_stats stats
			LEFT JOIN app_users users ON users.id = stats.user_id
			WHERE stats.action_type = 'search'
				AND stats.search_query IS NOT NULL
				AND LOWER(stats.search_query) LIKE ${searchLike}
				AND stats.recorded_at >= ${input.startAt}
				AND stats.recorded_at < ${input.endAt}
				AND COALESCE(users.email_normalized, LOWER(stats.user_email)) IS NOT NULL
			GROUP BY COALESCE(users.email_normalized, LOWER(stats.user_email))
			HAVING COUNT(*) >= ${safeMinHits}
			ORDER BY "hitCount" DESC, MAX(stats.recorded_at) DESC
			LIMIT ${safeLimit}
		`;

		return rows.map((row) => ({
			email: row.email,
			hitCount: row.hitCount,
			lastSeenAt:
				row.lastSeenAt instanceof Date
					? row.lastSeenAt.toISOString()
					: new Date(row.lastSeenAt).toISOString(),
		}));
	}

	async listRecentForUser(input: {
		email?: string | null;
		userId?: string | null;
		limit: number;
	}): Promise<
		Array<{
			actionType: DiscoveryActionType;
			filterGroup: string | null;
			filterValue: string | null;
			searchQuery: string | null;
			recordedAt: string;
		}>
	> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const normalizedEmail = input.email?.trim().toLowerCase();
		const userId = cleanString(input.userId, 80);

		if (userId && normalizedEmail) {
			const rows = await this.sql<
				Array<{
					actionType: DiscoveryActionType;
					filterGroup: string | null;
					filterValue: string | null;
					searchQuery: string | null;
					recordedAt: Date | string;
				}>
			>`
				SELECT
					stats.action_type AS "actionType",
					stats.filter_group AS "filterGroup",
					stats.filter_value AS "filterValue",
					stats.search_query AS "searchQuery",
					stats.recorded_at AS "recordedAt"
				FROM app_discovery_analytics_stats stats
				LEFT JOIN app_users users ON users.id = stats.user_id
				WHERE stats.user_id = ${userId}
					OR users.email_normalized = ${normalizedEmail}
					OR LOWER(stats.user_email) = ${normalizedEmail}
				ORDER BY stats.recorded_at DESC
				LIMIT ${safeLimit}
			`;
			return rows.map((row) => ({
				actionType: row.actionType,
				filterGroup: row.filterGroup,
				filterValue: row.filterValue,
				searchQuery: row.searchQuery,
				recordedAt:
					row.recordedAt instanceof Date
						? row.recordedAt.toISOString()
						: new Date(row.recordedAt).toISOString(),
			}));
		}

		if (userId) {
			const userIdRows = await this.sql<
				Array<{
					actionType: DiscoveryActionType;
					filterGroup: string | null;
					filterValue: string | null;
					searchQuery: string | null;
					recordedAt: Date | string;
				}>
			>`
				SELECT
					stats.action_type AS "actionType",
					stats.filter_group AS "filterGroup",
					stats.filter_value AS "filterValue",
					stats.search_query AS "searchQuery",
					stats.recorded_at AS "recordedAt"
				FROM app_discovery_analytics_stats stats
				WHERE stats.user_id = ${userId}
				ORDER BY stats.recorded_at DESC
				LIMIT ${safeLimit}
			`;
			return userIdRows.map((row) => ({
				actionType: row.actionType,
				filterGroup: row.filterGroup,
				filterValue: row.filterValue,
				searchQuery: row.searchQuery,
				recordedAt:
					row.recordedAt instanceof Date
						? row.recordedAt.toISOString()
						: new Date(row.recordedAt).toISOString(),
			}));
		}

		if (!normalizedEmail) {
			return [];
		}

		const rows = await this.sql<
			Array<{
				actionType: DiscoveryActionType;
				filterGroup: string | null;
				filterValue: string | null;
				searchQuery: string | null;
				recordedAt: Date | string;
			}>
		>`
			SELECT
				stats.action_type AS "actionType",
				stats.filter_group AS "filterGroup",
				stats.filter_value AS "filterValue",
				stats.search_query AS "searchQuery",
				stats.recorded_at AS "recordedAt"
			FROM app_discovery_analytics_stats stats
			LEFT JOIN app_users users ON users.id = stats.user_id
			WHERE users.email_normalized = ${normalizedEmail}
				OR LOWER(stats.user_email) = ${normalizedEmail}
			ORDER BY stats.recorded_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			actionType: row.actionType,
			filterGroup: row.filterGroup,
			filterValue: row.filterValue,
			searchQuery: row.searchQuery,
			recordedAt:
				row.recordedAt instanceof Date
					? row.recordedAt.toISOString()
					: new Date(row.recordedAt).toISOString(),
		}));
	}
}

export const getDiscoveryAnalyticsRepository =
	(): DiscoveryAnalyticsRepository | null => {
		if (
			globalThis.__ooocFeteFinderDiscoveryAnalyticsRepository &&
			globalThis.__ooocFeteFinderDiscoveryAnalyticsRepository instanceof
				DiscoveryAnalyticsRepository
		) {
			return globalThis.__ooocFeteFinderDiscoveryAnalyticsRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new DiscoveryAnalyticsRepository(sql);
		globalThis.__ooocFeteFinderDiscoveryAnalyticsRepository = repository;
		return repository;
	};
