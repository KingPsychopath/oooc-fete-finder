import "server-only";

import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

const APP_KV_TABLE_NAME = "app_kv_store";
const EVENTS_CSV_KEY = "events-store:csv";
const EVENTS_META_KEY = "events-store:meta";

interface EventsStoreMetaShape {
	rowCount?: number;
	updatedAt?: string;
}

declare global {
	var __ooocFeteFinderAppKVRepository: AppKVStoreRepository | undefined;
}

export interface AppKVRecord {
	key: string;
	value: string;
	updatedAt: string;
}

export interface AppKVListOptions {
	prefix?: string;
	limit?: number;
}

export interface AppKVEventsStoreStats {
	hasCsv: boolean;
	hasMeta: boolean;
	metadataRowCount: number;
	rawCsvRowCount: number;
	rowCountMatches: boolean;
	metadataUpdatedAt: string | null;
}

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const safeParseMeta = (value: string): EventsStoreMetaShape | null => {
	try {
		const parsed = JSON.parse(value) as EventsStoreMetaShape;
		if (!parsed || typeof parsed !== "object") return null;
		return parsed;
	} catch {
		return null;
	}
};

const countCsvRows = (csv: string): number => {
	const lines = csv
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	return Math.max(0, lines.length - 1);
};

export class AppKVStoreRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_kv_store (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async getValue(key: string): Promise<string | null> {
		await this.ready();
		const rows = await this.sql<{ value: string }[]>`
			SELECT value
			FROM app_kv_store
			WHERE key = ${key}
			LIMIT 1
		`;
		return rows[0]?.value ?? null;
	}

	async getRecord(key: string): Promise<AppKVRecord | null> {
		await this.ready();
		const rows = await this.sql<
			{ key: string; value: string; updated_at: Date | string }[]
		>`
			SELECT key, value, updated_at
			FROM app_kv_store
			WHERE key = ${key}
			LIMIT 1
		`;

		const record = rows[0];
		if (!record) return null;

		return {
			key: record.key,
			value: record.value,
			updatedAt: toIsoString(record.updated_at),
		};
	}

	async upsertValue(key: string, value: string): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO app_kv_store (key, value, updated_at)
			VALUES (${key}, ${value}, NOW())
			ON CONFLICT (key)
			DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`;
	}

	async deleteKey(key: string): Promise<void> {
		await this.ready();
		await this.sql`
			DELETE FROM app_kv_store
			WHERE key = ${key}
		`;
	}

	async listKeys(options?: AppKVListOptions): Promise<string[]> {
		await this.ready();
		const limit = Math.max(1, Math.min(options?.limit ?? 500, 2000));
		const prefix = options?.prefix?.trim() ?? "";

		if (!prefix) {
			const rows = await this.sql<{ key: string }[]>`
				SELECT key
				FROM app_kv_store
				ORDER BY key ASC
				LIMIT ${limit}
			`;
			return rows.map((row) => row.key);
		}

		const rows = await this.sql<{ key: string }[]>`
			SELECT key
			FROM app_kv_store
			WHERE key LIKE ${`${prefix}%`}
			ORDER BY key ASC
			LIMIT ${limit}
		`;
		return rows.map((row) => row.key);
	}

	async listRecords(options?: AppKVListOptions): Promise<AppKVRecord[]> {
		await this.ready();
		const limit = Math.max(1, Math.min(options?.limit ?? 100, 1000));
		const prefix = options?.prefix?.trim() ?? "";

		const rows =
			!prefix ?
				await this.sql<
					{ key: string; value: string; updated_at: Date | string }[]
				>`
					SELECT key, value, updated_at
					FROM app_kv_store
					ORDER BY key ASC
					LIMIT ${limit}
				`
			:	await this.sql<
					{ key: string; value: string; updated_at: Date | string }[]
				>`
					SELECT key, value, updated_at
					FROM app_kv_store
					WHERE key LIKE ${`${prefix}%`}
					ORDER BY key ASC
					LIMIT ${limit}
				`;

		return rows.map((row) => ({
			key: row.key,
			value: row.value,
			updatedAt: toIsoString(row.updated_at),
		}));
	}

	async countKeys(prefix?: string): Promise<number> {
		await this.ready();
		const normalizedPrefix = prefix?.trim() ?? "";

		if (!normalizedPrefix) {
			const rows = await this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM app_kv_store
			`;
			return rows[0]?.count ?? 0;
		}

		const rows = await this.sql<{ count: number }[]>`
			SELECT COUNT(*)::int AS count
			FROM app_kv_store
			WHERE key LIKE ${`${normalizedPrefix}%`}
		`;
		return rows[0]?.count ?? 0;
	}

	async getEventsStoreStats(): Promise<AppKVEventsStoreStats> {
		await this.ready();

		const [csvRecord, metaRecord] = await Promise.all([
			this.getRecord(EVENTS_CSV_KEY),
			this.getRecord(EVENTS_META_KEY),
		]);

		const rawCsvRowCount = csvRecord ? countCsvRows(csvRecord.value) : 0;
		const parsedMeta = metaRecord ? safeParseMeta(metaRecord.value) : null;
		const metadataRowCount =
			parsedMeta && typeof parsedMeta.rowCount === "number" ?
				Math.max(0, parsedMeta.rowCount)
			:	0;

		return {
			hasCsv: Boolean(csvRecord),
			hasMeta: Boolean(metaRecord),
			metadataRowCount,
			rawCsvRowCount,
			rowCountMatches: metadataRowCount === rawCsvRowCount,
			metadataUpdatedAt:
				parsedMeta?.updatedAt && typeof parsedMeta.updatedAt === "string" ?
					parsedMeta.updatedAt
				:	null,
		};
	}
}

export const getAppKVStoreRepository = (): AppKVStoreRepository | null => {
	const sql = getPostgresClient();
	if (!sql) return null;

	if (!globalThis.__ooocFeteFinderAppKVRepository) {
		globalThis.__ooocFeteFinderAppKVRepository = new AppKVStoreRepository(sql);
	}

	return globalThis.__ooocFeteFinderAppKVRepository;
};

export const getAppKVStoreTableName = (): string => APP_KV_TABLE_NAME;
