import "server-only";

import { randomUUID } from "crypto";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";
import {
	normalizeEventSheetRowData,
	type NormalizedRowDataRecord,
} from "./row-data-normalizer";

export type EventStoreOrigin =
	| "manual"
	| "google-import"
	| "google-sync"
	| "local-file-import";

export interface EventSheetColumnRecord {
	key: string;
	label: string;
	isCore: boolean;
	isRequired: boolean;
	displayOrder: number;
}

export type EventSheetRowRecord = NormalizedRowDataRecord;

export interface EventSheetMetaRecord {
	rowCount: number;
	updatedAt: string;
	updatedBy: string;
	origin: EventStoreOrigin;
	checksum: string;
}

declare global {
	var __ooocFeteFinderEventSheetStoreRepository:
		| EventSheetStoreRepository
		| undefined;
}

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const defaultMeta = (): EventSheetMetaRecord => ({
	rowCount: 0,
	updatedAt: new Date(0).toISOString(),
	updatedBy: "system",
	origin: "manual",
	checksum: "",
});

export class EventSheetStoreRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_store_columns (
				key TEXT PRIMARY KEY,
				label TEXT NOT NULL,
				is_core BOOLEAN NOT NULL,
				is_required BOOLEAN NOT NULL,
				display_order INTEGER NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_store_rows (
				id TEXT PRIMARY KEY,
				display_order INTEGER NOT NULL,
				row_data JSONB NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_store_rows_display_order
			ON app_event_store_rows (display_order ASC)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_store_meta (
				singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
				row_count INTEGER NOT NULL DEFAULT 0,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_by TEXT NOT NULL DEFAULT 'system',
				origin TEXT NOT NULL DEFAULT 'manual',
				checksum TEXT NOT NULL DEFAULT ''
			)
		`;

	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async getMeta(): Promise<EventSheetMetaRecord> {
		await this.ready();
		const rows = await this.sql<
			{
				row_count: number;
				updated_at: Date | string;
				updated_by: string;
				origin: EventStoreOrigin;
				checksum: string;
			}[]
		>`
			SELECT row_count, updated_at, updated_by, origin, checksum
			FROM app_event_store_meta
			WHERE singleton = TRUE
			LIMIT 1
		`;

		const record = rows[0];
		if (!record) return defaultMeta();

		return {
			rowCount: record.row_count,
			updatedAt: toIsoString(record.updated_at),
			updatedBy: record.updated_by,
			origin: record.origin,
			checksum: record.checksum,
		};
	}

	async getColumns(): Promise<EventSheetColumnRecord[]> {
		await this.ready();
		const rows = await this.sql<
			{
				key: string;
				label: string;
				is_core: boolean;
				is_required: boolean;
				display_order: number;
			}[]
		>`
			SELECT key, label, is_core, is_required, display_order
			FROM app_event_store_columns
			ORDER BY display_order ASC, key ASC
		`;

		return rows.map((row) => ({
			key: row.key,
			label: row.label,
			isCore: row.is_core,
			isRequired: row.is_required,
			displayOrder: row.display_order,
		}));
	}

	async getRows(): Promise<EventSheetRowRecord[]> {
		await this.ready();
		const rows = await this.sql<
			{
				row_data: unknown;
			}[]
		>`
			SELECT row_data
			FROM app_event_store_rows
			ORDER BY display_order ASC, id ASC
		`;

		return rows.map((row) => normalizeEventSheetRowData(row.row_data));
	}

	async getSheet(): Promise<{
		columns: EventSheetColumnRecord[];
		rows: EventSheetRowRecord[];
		meta: EventSheetMetaRecord;
	}> {
		await this.ready();
		const [columns, rows, meta] = await Promise.all([
			this.getColumns(),
			this.getRows(),
			this.getMeta(),
		]);
		return { columns, rows, meta };
	}

	async replaceSheet(
		columns: EventSheetColumnRecord[],
		rows: EventSheetRowRecord[],
		meta: Omit<EventSheetMetaRecord, "rowCount" | "updatedAt">,
	): Promise<EventSheetMetaRecord> {
		await this.ready();
		const nowIso = new Date().toISOString();

		await this.sql`DELETE FROM app_event_store_rows`;
		await this.sql`DELETE FROM app_event_store_columns`;

		let order = 0;
		for (const column of columns) {
			await this.sql`
				INSERT INTO app_event_store_columns (
					key,
					label,
					is_core,
					is_required,
					display_order,
					created_at,
					updated_at
				)
				VALUES (
					${column.key},
					${column.label},
					${column.isCore},
					${column.isRequired},
					${order},
					NOW(),
					NOW()
				)
			`;
			order += 1;
		}

		let rowOrder = 0;
		for (const row of rows) {
			const normalizedRow = Object.fromEntries(
				Object.entries(row).map(([key, value]) => [key, String(value ?? "")]),
			);
			await this.sql`
				INSERT INTO app_event_store_rows (
					id,
					display_order,
					row_data,
					created_at,
					updated_at
				)
				VALUES (
					${randomUUID()},
					${rowOrder},
					${this.sql.json(normalizedRow)},
					NOW(),
					NOW()
				)
			`;
			rowOrder += 1;
		}

		await this.sql`
			INSERT INTO app_event_store_meta (
				singleton,
				row_count,
				updated_at,
				updated_by,
				origin,
				checksum
			)
			VALUES (
				TRUE,
				${rows.length},
				${nowIso},
				${meta.updatedBy},
				${meta.origin},
				${meta.checksum}
			)
			ON CONFLICT (singleton)
			DO UPDATE SET
				row_count = EXCLUDED.row_count,
				updated_at = EXCLUDED.updated_at,
				updated_by = EXCLUDED.updated_by,
				origin = EXCLUDED.origin,
				checksum = EXCLUDED.checksum
		`;

		return this.getMeta();
	}

	async clearSheet(): Promise<void> {
		await this.ready();
		await this.sql`DELETE FROM app_event_store_rows`;
		await this.sql`DELETE FROM app_event_store_columns`;
		await this.sql`
			INSERT INTO app_event_store_meta (
				singleton,
				row_count,
				updated_at,
				updated_by,
				origin,
				checksum
			)
			VALUES (TRUE, 0, NOW(), 'system', 'manual', '')
			ON CONFLICT (singleton)
			DO UPDATE SET
				row_count = 0,
				updated_at = NOW(),
				updated_by = 'system',
				origin = 'manual',
				checksum = ''
		`;
	}

	async getCounts(): Promise<{
		rowCount: number;
		columnCount: number;
	}> {
		await this.ready();
		const [rows, columns] = await Promise.all([
			this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM app_event_store_rows
			`,
			this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM app_event_store_columns
			`,
		]);

		return {
			rowCount: rows[0]?.count ?? 0,
			columnCount: columns[0]?.count ?? 0,
		};
	}

	getStorageLocation(): string {
		return "Postgres tables app_event_store_rows + app_event_store_columns";
	}
}

export const getEventSheetStoreRepository = (): EventSheetStoreRepository | null => {
	const sql = getPostgresClient();
	if (!sql) return null;

	if (!globalThis.__ooocFeteFinderEventSheetStoreRepository) {
		globalThis.__ooocFeteFinderEventSheetStoreRepository =
			new EventSheetStoreRepository(sql);
	}

	return globalThis.__ooocFeteFinderEventSheetStoreRepository;
};
