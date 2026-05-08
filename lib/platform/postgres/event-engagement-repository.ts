import "server-only";

import type {
	EventEngagementRecordInput,
	EventEngagementSummary,
} from "@/features/events/engagement/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderEventEngagementRepository:
		| EventEngagementRepository
		| undefined;
}

type EventEngagementSummaryRow = {
	eventKey: string;
	clickCount: number;
	dedupedViewCount: number;
	outboundClickCount: number;
	calendarSyncCount: number;
	uniqueSessionCount: number;
	uniqueViewSessionCount: number;
	uniqueOutboundSessionCount: number;
	uniqueCalendarSessionCount: number;
};

const EVENT_VIEW_DEDUPE_WINDOW_SECONDS = 10 * 60;

type EventEngagementDailyRow = {
	day: string;
	clickCount: number;
	outboundClickCount: number;
	calendarSyncCount: number;
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

const toSafeIsoTimestamp = (value?: string): string => {
	if (!value) return new Date().toISOString();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
	return parsed.toISOString();
};

export class EventEngagementRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_engagement_stats (
				id BIGSERIAL PRIMARY KEY,
				event_key TEXT NOT NULL,
				action_type TEXT NOT NULL CHECK (action_type IN ('click', 'outbound_click', 'calendar_sync')),
				user_id TEXT,
				session_id TEXT,
				source TEXT,
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
			ALTER TABLE app_event_engagement_stats
			ADD COLUMN IF NOT EXISTS user_id TEXT
		`;
		await this
			.sql`ALTER TABLE app_event_engagement_stats ADD COLUMN IF NOT EXISTS device_class TEXT`;
		await this
			.sql`ALTER TABLE app_event_engagement_stats ADD COLUMN IF NOT EXISTS platform TEXT`;
		await this
			.sql`ALTER TABLE app_event_engagement_stats ADD COLUMN IF NOT EXISTS browser_family TEXT`;
		await this
			.sql`ALTER TABLE app_event_engagement_stats ADD COLUMN IF NOT EXISTS timezone TEXT`;
		await this
			.sql`ALTER TABLE app_event_engagement_stats ADD COLUMN IF NOT EXISTS locale TEXT`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_engagement_event_time
			ON app_event_engagement_stats (event_key, recorded_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_engagement_action_time
			ON app_event_engagement_stats (action_type, recorded_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_engagement_time
			ON app_event_engagement_stats (recorded_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_engagement_user_time
			ON app_event_engagement_stats (user_id, recorded_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async recordEventAction(input: EventEngagementRecordInput): Promise<void> {
		await this.ready();
		const eventKey = cleanString(input.eventKey, 220);
		if (!eventKey) {
			throw new Error("Event key is required");
		}

		await this.sql`
			INSERT INTO app_event_engagement_stats (
				event_key,
				action_type,
				user_id,
				session_id,
				source,
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
				${eventKey},
				${input.actionType},
				${cleanString(input.userId, 80)},
				${cleanString(input.sessionId, 120)},
				${cleanString(input.source, 80)},
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
		deviceClass?: string | null;
		platform?: string | null;
		browserFamily?: string | null;
		timezone?: string | null;
		locale?: string | null;
		windowDays?: number;
	}): Promise<number> {
		await this.ready();
		const sessionId = cleanString(input.sessionId, 120);
		const userId = cleanString(input.userId, 80);
		if (!sessionId || !userId) return 0;
		const windowDays = Math.max(1, Math.min(input.windowDays ?? 30, 90));
		const rows = await this.sql<Array<{ id: number }>>`
			UPDATE app_event_engagement_stats
			SET
				user_id = COALESCE(user_id, ${userId}),
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

	async listTopEvents(input: {
		startAt: string;
		endAt: string;
		limit: number;
	}): Promise<EventEngagementSummary[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const rows = await this.sql<EventEngagementSummaryRow[]>`
			WITH filtered AS (
				SELECT
					event_key,
					action_type,
					session_id,
					recorded_at
				FROM app_event_engagement_stats
				WHERE recorded_at >= ${input.startAt}
					AND recorded_at < ${input.endAt}
			),
			annotated AS (
				SELECT
					event_key,
					action_type,
					session_id,
					recorded_at,
					LAG(recorded_at) OVER (
						PARTITION BY event_key, session_id, action_type
						ORDER BY recorded_at ASC
					) AS previous_recorded_at
				FROM filtered
			)
			SELECT
				event_key AS "eventKey",
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COALESCE(SUM(
					CASE
						WHEN action_type <> 'click' THEN 0
						WHEN session_id IS NULL THEN 1
						WHEN previous_recorded_at IS NULL THEN 1
						WHEN EXTRACT(EPOCH FROM (recorded_at - previous_recorded_at)) >= ${EVENT_VIEW_DEDUPE_WINDOW_SECONDS} THEN 1
						ELSE 0
					END
				), 0)::int AS "dedupedViewCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'click')::int AS "uniqueViewSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'outbound_click')::int AS "uniqueOutboundSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'calendar_sync')::int AS "uniqueCalendarSessionCount"
			FROM annotated
			GROUP BY event_key
			ORDER BY "clickCount" DESC, "outboundClickCount" DESC, "calendarSyncCount" DESC
			LIMIT ${safeLimit}
		`;
		return rows;
	}

	async summarizeWindow(input: {
		startAt: string;
		endAt: string;
	}): Promise<{
		clickCount: number;
		dedupedViewCount: number;
		outboundClickCount: number;
		calendarSyncCount: number;
		uniqueSessionCount: number;
		uniqueViewSessionCount: number;
		uniqueOutboundSessionCount: number;
		uniqueCalendarSessionCount: number;
	}> {
		await this.ready();
		const rows = await this.sql<
			Array<{
				clickCount: number;
				dedupedViewCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
				uniqueViewSessionCount: number;
				uniqueOutboundSessionCount: number;
				uniqueCalendarSessionCount: number;
			}>
		>`
			WITH filtered AS (
				SELECT
					event_key,
					action_type,
					session_id,
					recorded_at
				FROM app_event_engagement_stats
				WHERE recorded_at >= ${input.startAt}
					AND recorded_at < ${input.endAt}
			),
			annotated AS (
				SELECT
					event_key,
					action_type,
					session_id,
					recorded_at,
					LAG(recorded_at) OVER (
						PARTITION BY event_key, session_id, action_type
						ORDER BY recorded_at ASC
					) AS previous_recorded_at
				FROM filtered
			)
			SELECT
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COALESCE(SUM(
					CASE
						WHEN action_type <> 'click' THEN 0
						WHEN session_id IS NULL THEN 1
						WHEN previous_recorded_at IS NULL THEN 1
						WHEN EXTRACT(EPOCH FROM (recorded_at - previous_recorded_at)) >= ${EVENT_VIEW_DEDUPE_WINDOW_SECONDS} THEN 1
						ELSE 0
					END
				), 0)::int AS "dedupedViewCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'click')::int AS "uniqueViewSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'outbound_click')::int AS "uniqueOutboundSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'calendar_sync')::int AS "uniqueCalendarSessionCount"
			FROM annotated
		`;

		return (
			rows[0] ?? {
				clickCount: 0,
				dedupedViewCount: 0,
				outboundClickCount: 0,
				calendarSyncCount: 0,
				uniqueSessionCount: 0,
				uniqueViewSessionCount: 0,
				uniqueOutboundSessionCount: 0,
				uniqueCalendarSessionCount: 0,
			}
		);
	}

	async summarizeEventWindow(input: {
		eventKey: string;
		startAt: string;
		endAt: string;
	}): Promise<EventEngagementSummary> {
		await this.ready();
		const rows = await this.sql<EventEngagementSummaryRow[]>`
			WITH filtered AS (
				SELECT
					event_key,
					action_type,
					session_id,
					recorded_at
				FROM app_event_engagement_stats
				WHERE event_key = ${input.eventKey}
					AND recorded_at >= ${input.startAt}
					AND recorded_at < ${input.endAt}
			),
			annotated AS (
				SELECT
					event_key,
					action_type,
					session_id,
					recorded_at,
					LAG(recorded_at) OVER (
						PARTITION BY event_key, session_id, action_type
						ORDER BY recorded_at ASC
					) AS previous_recorded_at
				FROM filtered
			)
			SELECT
				${input.eventKey}::text AS "eventKey",
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COALESCE(SUM(
					CASE
						WHEN action_type <> 'click' THEN 0
						WHEN session_id IS NULL THEN 1
						WHEN previous_recorded_at IS NULL THEN 1
						WHEN EXTRACT(EPOCH FROM (recorded_at - previous_recorded_at)) >= ${EVENT_VIEW_DEDUPE_WINDOW_SECONDS} THEN 1
						ELSE 0
					END
				), 0)::int AS "dedupedViewCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'click')::int AS "uniqueViewSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'outbound_click')::int AS "uniqueOutboundSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'calendar_sync')::int AS "uniqueCalendarSessionCount"
			FROM annotated
		`;
		return (
			rows[0] ?? {
				eventKey: input.eventKey,
				clickCount: 0,
				dedupedViewCount: 0,
				outboundClickCount: 0,
				calendarSyncCount: 0,
				uniqueSessionCount: 0,
				uniqueViewSessionCount: 0,
				uniqueOutboundSessionCount: 0,
				uniqueCalendarSessionCount: 0,
			}
		);
	}

	async listDailySeries(input: {
		startAt: string;
		endAt: string;
	}): Promise<EventEngagementDailyRow[]> {
		await this.ready();
		const rows = await this.sql<EventEngagementDailyRow[]>`
			SELECT
				TO_CHAR(DATE_TRUNC('day', recorded_at), 'YYYY-MM-DD') AS day,
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount"
			FROM app_event_engagement_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
			GROUP BY 1
			ORDER BY 1 ASC
		`;
		return rows;
	}

	async getSocialProofSaveCounts(input: {
		eventKeys: string[];
		windowDays: number;
	}): Promise<Map<string, number>> {
		await this.ready();
		const normalizedEventKeys = [
			...new Set(input.eventKeys.map((key) => key.trim())),
		]
			.filter((key) => key.length > 0)
			.slice(0, 2000);
		if (normalizedEventKeys.length === 0) {
			return new Map<string, number>();
		}
		const safeWindowDays = Math.max(
			1,
			Math.min(Math.floor(input.windowDays), 90),
		);

		const rows = await this.sql<Array<{ eventKey: string; count: number }>>`
			SELECT
				event_key AS "eventKey",
				(
					COUNT(DISTINCT session_id)
					+ COUNT(*) FILTER (WHERE session_id IS NULL)
				)::int AS count
			FROM app_event_engagement_stats
			WHERE action_type = 'calendar_sync'
				AND event_key = ANY(${normalizedEventKeys})
				AND recorded_at >= NOW() - (${safeWindowDays} * INTERVAL '1 day')
			GROUP BY event_key
		`;

		return new Map(rows.map((row) => [row.eventKey, row.count]));
	}

	async listRecentForUser(input: {
		email: string;
		userId?: string | null;
		limit: number;
	}): Promise<
		Array<{
			eventKey: string;
			actionType: string;
			source: string | null;
			recordedAt: string;
		}>
	> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const rows = await this.sql<
			Array<{
				eventKey: string;
				actionType: string;
				source: string | null;
				recordedAt: Date | string;
			}>
		>`
			SELECT
				stats.event_key AS "eventKey",
				stats.action_type AS "actionType",
				stats.source,
				stats.recorded_at AS "recordedAt"
			FROM app_event_engagement_stats stats
			LEFT JOIN app_users users ON users.id = stats.user_id
			WHERE (${input.userId ?? null}::text IS NOT NULL AND stats.user_id = ${input.userId ?? null})
				OR users.email_normalized = ${input.email.trim().toLowerCase()}
			ORDER BY stats.recorded_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			eventKey: row.eventKey,
			actionType: row.actionType,
			source: row.source,
			recordedAt:
				row.recordedAt instanceof Date
					? row.recordedAt.toISOString()
					: new Date(row.recordedAt).toISOString(),
		}));
	}
}

export const getEventEngagementRepository =
	(): EventEngagementRepository | null => {
		if (
			globalThis.__ooocFeteFinderEventEngagementRepository &&
			globalThis.__ooocFeteFinderEventEngagementRepository instanceof
				EventEngagementRepository
		) {
			return globalThis.__ooocFeteFinderEventEngagementRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new EventEngagementRepository(sql);
		globalThis.__ooocFeteFinderEventEngagementRepository = repository;
		return repository;
	};
