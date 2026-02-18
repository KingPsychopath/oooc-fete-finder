import "server-only";

import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

const RATE_LIMIT_TABLE_NAME = "app_rate_limit_counters";

declare global {
	var __ooocFeteFinderRateLimitRepository: RateLimitRepository | undefined;
}

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export interface RateLimitConsumeResult {
	allowed: boolean;
	count: number;
	limit: number;
	resetAt: string;
	retryAfterSeconds: number;
}

export class RateLimitRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_rate_limit_counters (
				scope TEXT NOT NULL,
				key_hash TEXT NOT NULL,
				window_seconds INTEGER NOT NULL,
				count INTEGER NOT NULL,
				reset_at TIMESTAMPTZ NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				PRIMARY KEY (scope, key_hash, window_seconds)
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_rate_limit_counters_reset_at
			ON app_rate_limit_counters (reset_at)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async consumeWindow(params: {
		scope: string;
		keyHash: string;
		windowSeconds: number;
		limit: number;
	}): Promise<RateLimitConsumeResult> {
		await this.ready();
		const safeWindowSeconds = Math.max(1, Math.floor(params.windowSeconds));
		const safeLimit = Math.max(1, Math.floor(params.limit));

		const rows = await this.sql<
			{
				count: number;
				reset_at: Date | string;
				retry_after_seconds: number;
			}[]
		>`
			WITH upserted AS (
				INSERT INTO app_rate_limit_counters (
					scope,
					key_hash,
					window_seconds,
					count,
					reset_at,
					updated_at
				)
				VALUES (
					${params.scope},
					${params.keyHash},
					${safeWindowSeconds},
					1,
					NOW() + (${safeWindowSeconds} * INTERVAL '1 second'),
					NOW()
				)
				ON CONFLICT (scope, key_hash, window_seconds)
				DO UPDATE SET
					count = CASE
						WHEN app_rate_limit_counters.reset_at <= NOW()
							THEN 1
						ELSE app_rate_limit_counters.count + 1
					END,
					reset_at = CASE
						WHEN app_rate_limit_counters.reset_at <= NOW()
							THEN NOW() + (${safeWindowSeconds} * INTERVAL '1 second')
						ELSE app_rate_limit_counters.reset_at
					END,
					updated_at = NOW()
				RETURNING count, reset_at
			)
			SELECT
				count,
				reset_at,
				GREATEST(
					1,
					CEIL(EXTRACT(EPOCH FROM (reset_at - NOW())))
				)::int AS retry_after_seconds
			FROM upserted
			LIMIT 1
		`;

		const row = rows[0];
		if (!row) {
			throw new Error("Rate limit counter upsert returned no rows");
		}

		return {
			allowed: row.count <= safeLimit,
			count: row.count,
			limit: safeLimit,
			resetAt: toIsoString(row.reset_at),
			retryAfterSeconds: Math.max(1, row.retry_after_seconds),
		};
	}

	async cleanupExpired(graceSeconds: number): Promise<number> {
		await this.ready();
		const safeGraceSeconds = Math.max(0, Math.floor(graceSeconds));
		const rows = await this.sql<{ count: number }[]>`
			WITH deleted AS (
				DELETE FROM app_rate_limit_counters
				WHERE reset_at < NOW() - (${safeGraceSeconds} * INTERVAL '1 second')
				RETURNING 1
			)
			SELECT COUNT(*)::int AS count
			FROM deleted
		`;

		return rows[0]?.count ?? 0;
	}
}

export const getRateLimitRepository = (): RateLimitRepository | null => {
	const sql = getPostgresClient();
	if (!sql) return null;

	if (!globalThis.__ooocFeteFinderRateLimitRepository) {
		globalThis.__ooocFeteFinderRateLimitRepository = new RateLimitRepository(
			sql,
		);
	}

	return globalThis.__ooocFeteFinderRateLimitRepository;
};

export const getRateLimitTableName = (): string => RATE_LIMIT_TABLE_NAME;
