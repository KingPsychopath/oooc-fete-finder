import "server-only";

import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderActionMetricsRepository:
		| ActionMetricsRepository
		| undefined;
}

export interface ActionMetricRecordInput {
	actionName: string;
	durationMs: number;
	queryCount: number;
	success: boolean;
	recordedAt: string;
}

export interface ActionMetricSummary {
	actionName: string;
	sampleCount: number;
	p50DurationMs: number;
	p95DurationMs: number;
	p99DurationMs: number;
	averageDurationMs: number;
	averageQueryCount: number;
	errorRate: number;
}

export class ActionMetricsRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_action_metrics (
				id BIGSERIAL PRIMARY KEY,
				action_name TEXT NOT NULL,
				duration_ms DOUBLE PRECISION NOT NULL,
				query_count INTEGER NOT NULL DEFAULT 0,
				success BOOLEAN NOT NULL,
				recorded_at TIMESTAMPTZ NOT NULL
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_action_metrics_action_recorded_at
			ON app_action_metrics (action_name, recorded_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_action_metrics_recorded_at
			ON app_action_metrics (recorded_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async recordMetric(input: ActionMetricRecordInput): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO app_action_metrics (
				action_name,
				duration_ms,
				query_count,
				success,
				recorded_at
			)
			VALUES (
				${input.actionName},
				${Math.max(0, input.durationMs)},
				${Math.max(0, Math.floor(input.queryCount))},
				${input.success},
				${input.recordedAt}
			)
		`;
	}

	async summarizeWindow(windowMinutes: number): Promise<ActionMetricSummary[]> {
		await this.ready();
		const safeWindowMinutes = Math.max(1, Math.min(windowMinutes, 24 * 60));
		const rows = await this.sql<ActionMetricSummary[]>`
			SELECT
				action_name AS "actionName",
				COUNT(*)::int AS "sampleCount",
				COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS "p50DurationMs",
				COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS "p95DurationMs",
				COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms), 0)::float8 AS "p99DurationMs",
				COALESCE(AVG(duration_ms), 0)::float8 AS "averageDurationMs",
				COALESCE(AVG(query_count), 0)::float8 AS "averageQueryCount",
				COALESCE(AVG(CASE WHEN success THEN 0 ELSE 1 END), 0)::float8 AS "errorRate"
			FROM app_action_metrics
			WHERE recorded_at >= NOW() - (${safeWindowMinutes} * INTERVAL '1 minute')
			GROUP BY action_name
			ORDER BY "p95DurationMs" DESC, "sampleCount" DESC
		`;

		return rows;
	}

	async clearAllMetrics(): Promise<number> {
		await this.ready();
		const rows = await this.sql<{ count: number }[]>`
			WITH deleted AS (
				DELETE FROM app_action_metrics
				RETURNING id
			)
			SELECT COUNT(*)::int AS count
			FROM deleted
		`;
		return rows[0]?.count ?? 0;
	}
}

export const getActionMetricsRepository =
	(): ActionMetricsRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (!globalThis.__ooocFeteFinderActionMetricsRepository) {
			globalThis.__ooocFeteFinderActionMetricsRepository =
				new ActionMetricsRepository(sql);
		}

		return globalThis.__ooocFeteFinderActionMetricsRepository;
	};
