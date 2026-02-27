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
	outboundClickCount: number;
	calendarSyncCount: number;
	uniqueSessionCount: number;
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
				session_id TEXT,
				source TEXT,
				path TEXT,
				is_authenticated BOOLEAN,
				recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

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
				session_id,
				source,
				path,
				is_authenticated,
				recorded_at
			)
			VALUES (
				${eventKey},
				${input.actionType},
				${cleanString(input.sessionId, 120)},
				${cleanString(input.source, 80)},
				${cleanString(input.path, 280)},
				${input.isAuthenticated ?? null},
				${toSafeIsoTimestamp(input.recordedAt)}
			)
		`;
	}

	async listTopEvents(input: {
		startAt: string;
		endAt: string;
		limit: number;
	}): Promise<EventEngagementSummary[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const rows = await this.sql<EventEngagementSummaryRow[]>`
			SELECT
				event_key AS "eventKey",
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount"
			FROM app_event_engagement_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
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
		outboundClickCount: number;
		calendarSyncCount: number;
		uniqueSessionCount: number;
	}> {
		await this.ready();
		const rows = await this.sql<
			Array<{
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
			}>
		>`
			SELECT
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount"
			FROM app_event_engagement_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
		`;

		return (
			rows[0] ?? {
				clickCount: 0,
				outboundClickCount: 0,
				calendarSyncCount: 0,
				uniqueSessionCount: 0,
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
			SELECT
				${input.eventKey}::text AS "eventKey",
				COUNT(*) FILTER (WHERE action_type = 'click')::int AS "clickCount",
				COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS "outboundClickCount",
				COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS "calendarSyncCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount"
			FROM app_event_engagement_stats
			WHERE event_key = ${input.eventKey}
				AND recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
		`;
		return (
			rows[0] ?? {
				eventKey: input.eventKey,
				clickCount: 0,
				outboundClickCount: 0,
				calendarSyncCount: 0,
				uniqueSessionCount: 0,
			}
		);
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
