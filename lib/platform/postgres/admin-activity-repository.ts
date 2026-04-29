import "server-only";

import { randomUUID } from "crypto";
import type {
	AdminActivityActorType,
	AdminActivityCategory,
	AdminActivityEvent,
	AdminActivityRecordInput,
	AdminActivitySeverity,
} from "@/features/admin/activity/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderAdminActivityRepository:
		| AdminActivityRepository
		| undefined;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type AdminActivityRow = {
	id: string;
	occurred_at: Date | string;
	actor_type: AdminActivityActorType;
	actor_label: string;
	actor_session_jti: string | null;
	action: string;
	category: AdminActivityCategory;
	target_type: string;
	target_id: string | null;
	target_label: string | null;
	summary: string;
	metadata: unknown;
	severity: AdminActivitySeverity;
	href: string | null;
};

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toJsonValue = (value: unknown): JsonValue => {
	if (value == null) return {};
	return JSON.parse(JSON.stringify(value)) as JsonValue;
};

const toJsonObject = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, unknown>;
};

const toEvent = (row: AdminActivityRow): AdminActivityEvent => ({
	id: row.id,
	occurredAt: toIsoString(row.occurred_at),
	actorType: row.actor_type,
	actorLabel: row.actor_label,
	actorSessionJti: row.actor_session_jti,
	action: row.action,
	category: row.category,
	targetType: row.target_type,
	targetId: row.target_id,
	targetLabel: row.target_label,
	summary: row.summary,
	metadata: toJsonObject(row.metadata),
	severity: row.severity,
	href: row.href,
});

export class AdminActivityRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_admin_activity_events (
				id TEXT PRIMARY KEY,
				occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				actor_type TEXT NOT NULL CHECK (actor_type IN ('admin_session', 'admin_key', 'cron', 'system')),
				actor_label TEXT NOT NULL,
				actor_session_jti TEXT NULL,
				action TEXT NOT NULL,
				category TEXT NOT NULL CHECK (category IN ('auth', 'content', 'insights', 'operations', 'placements', 'settings')),
				target_type TEXT NOT NULL,
				target_id TEXT NULL,
				target_label TEXT NULL,
				summary TEXT NOT NULL,
				metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
				severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'destructive')),
				href TEXT NULL
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_admin_activity_events_occurred_at
			ON app_admin_activity_events (occurred_at DESC, id DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_admin_activity_events_category
			ON app_admin_activity_events (category, occurred_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_admin_activity_events_action
			ON app_admin_activity_events (action, occurred_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_admin_activity_events_actor_session
			ON app_admin_activity_events (actor_session_jti, occurred_at DESC)
			WHERE actor_session_jti IS NOT NULL
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async create(
		input: Required<AdminActivityRecordInput>,
	): Promise<AdminActivityEvent> {
		await this.ready();
		const id = randomUUID();
		const rows = await this.sql<AdminActivityRow[]>`
			INSERT INTO app_admin_activity_events (
				id,
				actor_type,
				actor_label,
				actor_session_jti,
				action,
				category,
				target_type,
				target_id,
				target_label,
				summary,
				metadata,
				severity,
				href
			)
			VALUES (
				${id},
				${input.actorType},
				${input.actorLabel},
				${input.actorSessionJti},
				${input.action},
				${input.category},
				${input.targetType},
				${input.targetId},
				${input.targetLabel},
				${input.summary},
				${this.sql.json(toJsonValue(input.metadata))},
				${input.severity},
				${input.href}
			)
			RETURNING
				id,
				occurred_at,
				actor_type,
				actor_label,
				actor_session_jti,
				action,
				category,
				target_type,
				target_id,
				target_label,
				summary,
				metadata,
				severity,
				href
		`;

		const event = rows[0];
		if (!event) {
			throw new Error("Failed to record admin activity");
		}

		return toEvent(event);
	}

	async listRecent(input?: {
		limit?: number;
		category?: AdminActivityCategory | "all";
	}): Promise<AdminActivityEvent[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input?.limit ?? 50, 200));
		const category = input?.category === "all" ? undefined : input?.category;

		const rows = await this.sql<AdminActivityRow[]>`
			SELECT
				id,
				occurred_at,
				actor_type,
				actor_label,
				actor_session_jti,
				action,
				category,
				target_type,
				target_id,
				target_label,
				summary,
				metadata,
				severity,
				href
			FROM app_admin_activity_events
			${category ? this.sql`WHERE category = ${category}` : this.sql``}
			ORDER BY occurred_at DESC, id DESC
			LIMIT ${safeLimit}
		`;

		return rows.map(toEvent);
	}

	async countByCategory(): Promise<Record<AdminActivityCategory, number>> {
		await this.ready();
		const rows = await this.sql<
			Array<{ category: AdminActivityCategory; count: number }>
		>`
			SELECT category, COUNT(*)::int AS count
			FROM app_admin_activity_events
			GROUP BY category
		`;

		return rows.reduce(
			(accumulator, row) => ({
				...accumulator,
				[row.category]: row.count,
			}),
			{
				auth: 0,
				content: 0,
				insights: 0,
				operations: 0,
				placements: 0,
				settings: 0,
			} satisfies Record<AdminActivityCategory, number>,
		);
	}

	async clearAllEvents(): Promise<number> {
		await this.ready();
		const rows = await this.sql<{ count: number }[]>`
			WITH deleted AS (
				DELETE FROM app_admin_activity_events
				RETURNING id
			)
			SELECT COUNT(*)::int AS count
			FROM deleted
		`;
		return rows[0]?.count ?? 0;
	}
}

export const getAdminActivityRepository =
	(): AdminActivityRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (!globalThis.__ooocFeteFinderAdminActivityRepository) {
			globalThis.__ooocFeteFinderAdminActivityRepository =
				new AdminActivityRepository(sql);
		}

		return globalThis.__ooocFeteFinderAdminActivityRepository;
	};
