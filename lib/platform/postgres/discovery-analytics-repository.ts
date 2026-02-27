import "server-only";

import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderDiscoveryAnalyticsRepository:
		| DiscoveryAnalyticsRepository
		| undefined;
}

export type DiscoveryActionType = "search" | "filter_apply" | "filter_clear";

export interface DiscoveryAnalyticsRecordInput {
	actionType: DiscoveryActionType;
	sessionId?: string | null;
	userEmail?: string | null;
	filterGroup?: string | null;
	filterValue?: string | null;
	searchQuery?: string | null;
	path?: string | null;
	isAuthenticated?: boolean | null;
	recordedAt?: string;
}

const cleanString = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed.slice(0, maxLength);
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
				action_type TEXT NOT NULL CHECK (action_type IN ('search', 'filter_apply', 'filter_clear')),
				session_id TEXT,
				user_email TEXT,
				filter_group TEXT,
				filter_value TEXT,
				search_query TEXT,
				path TEXT,
				is_authenticated BOOLEAN,
				recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

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
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async recordAction(input: DiscoveryAnalyticsRecordInput): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO app_discovery_analytics_stats (
				action_type,
				session_id,
				user_email,
				filter_group,
				filter_value,
				search_query,
				path,
				is_authenticated,
				recorded_at
			)
			VALUES (
				${input.actionType},
				${cleanString(input.sessionId, 120)},
				${cleanString(input.userEmail, 320)},
				${cleanString(input.filterGroup, 80)},
				${cleanString(input.filterValue, 120)},
				${cleanString(input.searchQuery, 280)},
				${cleanString(input.path, 280)},
				${input.isAuthenticated ?? null},
				${toSafeIsoTimestamp(input.recordedAt)}
			)
		`;
	}

	async summarizeWindow(input: {
		startAt: string;
		endAt: string;
	}): Promise<{
		searchCount: number;
		filterApplyCount: number;
		filterClearCount: number;
		uniqueSessionCount: number;
	}> {
		await this.ready();
		const rows = await this.sql<
			Array<{
				searchCount: number;
				filterApplyCount: number;
				filterClearCount: number;
				uniqueSessionCount: number;
			}>
		>`
			SELECT
				COUNT(*) FILTER (WHERE action_type = 'search')::int AS "searchCount",
				COUNT(*) FILTER (WHERE action_type = 'filter_apply')::int AS "filterApplyCount",
				COUNT(*) FILTER (WHERE action_type = 'filter_clear')::int AS "filterClearCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount"
			FROM app_discovery_analytics_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
		`;
		return (
			rows[0] ?? {
				searchCount: 0,
				filterApplyCount: 0,
				filterClearCount: 0,
				uniqueSessionCount: 0,
			}
		);
	}

	async listTopFilters(input: {
		startAt: string;
		endAt: string;
		limit: number;
	}): Promise<
		Array<{ filterGroup: string; filterValue: string; count: number }>
	> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
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
	}): Promise<Array<{ query: string; count: number }>> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
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
			GROUP BY search_query
			ORDER BY count DESC
			LIMIT ${safeLimit}
		`;
		return rows;
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
