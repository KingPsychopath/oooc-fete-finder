import "server-only";

import { createHash, randomUUID } from "crypto";
import type { EventRowLifecycleMetadata } from "@/features/data-management/event-sheet-revision-types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";
import {
	type NormalizedRowDataRecord,
	normalizeEventSheetRowData,
} from "./row-data-normalizer";

export type EventStoreOrigin = "manual" | "local-file-import";

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

export type EventSheetRowMetadataRecord = EventRowLifecycleMetadata;

declare global {
	var __ooocFeteFinderEventSheetStoreRepository:
		| EventSheetStoreRepository
		| undefined;
}

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const FIRST_SEEN_BACKFILL_DAYS = 30;
const getBackfillFirstSeenAt = (now: Date = new Date()): string =>
	new Date(
		now.getTime() - FIRST_SEEN_BACKFILL_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();

const defaultMeta = (): EventSheetMetaRecord => ({
	rowCount: 0,
	updatedAt: new Date(0).toISOString(),
	updatedBy: "system",
	origin: "manual",
	checksum: "",
});

const getRowEventKey = (row: EventSheetRowRecord): string | null => {
	const value = row.eventKey?.trim();
	return value ? value : null;
};

const normalizeRowDataRecord = (
	row: EventSheetRowRecord,
): EventSheetRowRecord => {
	const normalized = Object.fromEntries(
		Object.entries(row).map(([key, value]) => [key, String(value ?? "")]),
	);
	if (!normalized.area && normalized.districtArea) {
		normalized.area = normalized.districtArea;
	}
	delete normalized.districtArea;
	return normalized;
};

const MEANINGFUL_EVENT_FIELDS = [
	"hostCountry",
	"audienceCountry",
	"title",
	"date",
	"dateTo",
	"startTime",
	"endTime",
	"location",
	"area",
	"categories",
	"price",
	"primaryUrl",
	"ageGuidance",
	"setting",
	"notes",
] as const;

const LEGACY_MEANINGFUL_EVENT_FIELD_SETS = [
	[
		"curated",
		"eventCategory",
		"hostCountry",
		"audienceCountry",
		"title",
		"date",
		"dateTo",
		"startTime",
		"endTime",
		"location",
		"districtArea",
		"categories",
		"tags",
		"price",
		"primaryUrl",
		"ageGuidance",
		"setting",
		"notes",
		"sourceConfirmed",
		"detailsQualityOverride",
	],
	[
		"seriesKey",
		"curated",
		"eventCategory",
		"hostCountry",
		"audienceCountry",
		"title",
		"date",
		"dateTo",
		"startTime",
		"endTime",
		"location",
		"districtArea",
		"categories",
		"tags",
		"price",
		"primaryUrl",
		"ageGuidance",
		"setting",
		"notes",
		"sourceConfirmed",
		"detailsQualityOverride",
	],
	[
		"curated",
		"eventCategory",
		"hostCountry",
		"audienceCountry",
		"title",
		"date",
		"startTime",
		"endTime",
		"location",
		"districtArea",
		"categories",
		"tags",
		"price",
		"primaryUrl",
		"ageGuidance",
		"setting",
		"notes",
		"sourceConfirmed",
		"detailsQualityOverride",
	],
	[
		"curated",
		"hostCountry",
		"audienceCountry",
		"title",
		"date",
		"startTime",
		"endTime",
		"location",
		"districtArea",
		"categories",
		"tags",
		"price",
		"primaryUrl",
		"ageGuidance",
		"setting",
		"notes",
		"sourceConfirmed",
		"detailsQualityOverride",
	],
] as const;

const normalizeMeaningfulValue = (value: string | undefined): string =>
	(value ?? "").trim().replace(/\s+/g, " ");

const getMeaningfulFieldValue = (
	row: EventSheetRowRecord,
	field: string,
): string | undefined => {
	if (field === "area") return row.area ?? row.districtArea;
	if (field === "districtArea") return row.districtArea ?? row.area;
	return row[field];
};

const buildMeaningfulEventRowHashForFields = (
	row: EventSheetRowRecord,
	fields: readonly string[],
): string => {
	const payload = Object.fromEntries(
		fields.map((field) => [
			field,
			normalizeMeaningfulValue(getMeaningfulFieldValue(row, field)),
		]),
	);
	return createHash("sha256")
		.update(JSON.stringify(payload))
		.digest("hex")
		.slice(0, 16);
};

export const buildMeaningfulEventRowHash = (row: EventSheetRowRecord): string =>
	buildMeaningfulEventRowHashForFields(row, MEANINGFUL_EVENT_FIELDS);

export const isCompatibleMeaningfulEventRowHash = (
	hash: string | null | undefined,
	row: EventSheetRowRecord,
): boolean => {
	if (!hash) return false;
	if (hash === buildMeaningfulEventRowHash(row)) return true;
	return LEGACY_MEANINGFUL_EVENT_FIELD_SETS.some(
		(fields) => hash === buildMeaningfulEventRowHashForFields(row, fields),
	);
};

export class EventSheetStoreRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql.begin(async (transactionSql) => {
			const lockedSql = transactionSql as unknown as Sql;
			await lockedSql`
				SELECT pg_advisory_xact_lock(hashtext('oooc_fete_finder_event_store_schema'))
			`;

			await lockedSql`
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

			await lockedSql`
				CREATE TABLE IF NOT EXISTS app_event_store_rows (
					id TEXT PRIMARY KEY,
					display_order INTEGER NOT NULL,
					row_data JSONB NOT NULL,
					event_key TEXT,
					first_seen_at TIMESTAMPTZ,
					last_meaningful_change_at TIMESTAMPTZ,
					public_content_hash TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`;

			await lockedSql`
				ALTER TABLE app_event_store_rows
				ADD COLUMN IF NOT EXISTS event_key TEXT
			`;

			await lockedSql`
				ALTER TABLE app_event_store_rows
				ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ
			`;

			await lockedSql`
				ALTER TABLE app_event_store_rows
				ADD COLUMN IF NOT EXISTS last_meaningful_change_at TIMESTAMPTZ
			`;

			await lockedSql`
				ALTER TABLE app_event_store_rows
				ADD COLUMN IF NOT EXISTS public_content_hash TEXT
			`;

			await lockedSql`
				UPDATE app_event_store_rows
				SET event_key = NULLIF(row_data->>'eventKey', '')
				WHERE event_key IS NULL
			`;

			await lockedSql`
				UPDATE app_event_store_rows
				SET first_seen_at = NOW() - INTERVAL '30 days'
				WHERE first_seen_at IS NULL
			`;

			await lockedSql`
				UPDATE app_event_store_rows
				SET last_meaningful_change_at = first_seen_at
				WHERE last_meaningful_change_at IS NULL
			`;

			await lockedSql`
				CREATE INDEX IF NOT EXISTS idx_app_event_store_rows_display_order
				ON app_event_store_rows (display_order ASC)
			`;

			await lockedSql`
				CREATE INDEX IF NOT EXISTS idx_app_event_store_rows_event_key
				ON app_event_store_rows (event_key)
			`;

			await lockedSql`
				CREATE TABLE IF NOT EXISTS app_event_store_meta (
					singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
					row_count INTEGER NOT NULL DEFAULT 0,
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_by TEXT NOT NULL DEFAULT 'system',
					origin TEXT NOT NULL DEFAULT 'manual',
					checksum TEXT NOT NULL DEFAULT ''
				)
			`;
		});
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

	async hasEventKey(eventKey: string): Promise<boolean> {
		await this.ready();
		const normalizedEventKey = eventKey.trim().toLowerCase();
		if (!normalizedEventKey) return false;

		const rows = await this.sql<{ exists: boolean }[]>`
			SELECT EXISTS (
				SELECT 1
				FROM app_event_store_rows
				WHERE event_key = ${normalizedEventKey}
				LIMIT 1
			) AS exists
		`;
		return rows[0]?.exists === true;
	}

	async getRowMetadata(): Promise<EventSheetRowMetadataRecord[]> {
		await this.ready();
		const rows = await this.sql<
			{
				event_key: string | null;
				row_data: unknown;
				first_seen_at: Date | string | null;
				last_meaningful_change_at: Date | string | null;
				public_content_hash: string | null;
			}[]
		>`
			SELECT event_key, row_data, first_seen_at, last_meaningful_change_at, public_content_hash
			FROM app_event_store_rows
			WHERE event_key IS NOT NULL
			ORDER BY display_order ASC, id ASC
		`;

		return rows
			.filter((row) => row.event_key && row.first_seen_at)
			.map((row) => ({
				eventKey: row.event_key as string,
				firstSeenAt: toIsoString(row.first_seen_at as Date | string),
				lastMeaningfulChangeAt: row.last_meaningful_change_at
					? toIsoString(row.last_meaningful_change_at)
					: toIsoString(row.first_seen_at as Date | string),
				publicContentHash:
					row.public_content_hash ??
					buildMeaningfulEventRowHash(normalizeEventSheetRowData(row.row_data)),
			}));
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
		options?: { rowMetadata?: EventSheetRowMetadataRecord[] },
	): Promise<EventSheetMetaRecord> {
		await this.ready();
		const now = new Date();
		const nowIso = now.toISOString();
		const [existingMetadata, existingRows, counts] = await Promise.all([
			this.getRowMetadata(),
			this.getRows(),
			this.getCounts(),
		]);
		const hasExistingRows = counts.rowCount > 0;
		const defaultFirstSeenAt = hasExistingRows
			? nowIso
			: getBackfillFirstSeenAt(now);
		const firstSeenAtByEventKey = new Map(
			existingMetadata.map((record) => [record.eventKey, record.firstSeenAt]),
		);
		const existingMetadataByEventKey = new Map(
			existingMetadata.map((record) => [record.eventKey, record]),
		);
		const suppliedMetadataByEventKey = new Map(
			(options?.rowMetadata ?? []).map((record) => [record.eventKey, record]),
		);
		const existingRowsByEventKey = new Map(
			existingRows
				.map((row) => {
					const normalizedRow = normalizeRowDataRecord(row);
					return [getRowEventKey(normalizedRow), normalizedRow] as const;
				})
				.filter((entry): entry is readonly [string, EventSheetRowRecord] =>
					Boolean(entry[0]),
				),
		);

		await this.sql`DELETE FROM app_event_store_rows`;
		await this.sql`DELETE FROM app_event_store_columns`;

		const columnRows = columns.map((column, displayOrder) => ({
			key: column.key,
			label: column.label,
			is_core: column.isCore,
			is_required: column.isRequired,
			display_order: displayOrder,
		}));
		if (columnRows.length > 0) {
			await this.sql`
				INSERT INTO app_event_store_columns ${this.sql(
					columnRows,
					"key",
					"label",
					"is_core",
					"is_required",
					"display_order",
				)}
			`;
		}

		const rowRows = rows.map((row, displayOrder) => {
			const normalizedRow = normalizeRowDataRecord(row);
			const eventKey = getRowEventKey(normalizedRow);
			const publicContentHash = buildMeaningfulEventRowHash(normalizedRow);
			const existingRow = eventKey
				? existingRowsByEventKey.get(eventKey)
				: undefined;
			const existingCurrentContentHash = existingRow
				? buildMeaningfulEventRowHash(existingRow)
				: null;
			const unchangedPublicContent =
				existingCurrentContentHash === publicContentHash;
			const existing = eventKey
				? existingMetadataByEventKey.get(eventKey)
				: undefined;
			const supplied = eventKey
				? suppliedMetadataByEventKey.get(eventKey)
				: undefined;
			const baseline = supplied ?? existing;
			const hasMeaningfulChange = existingRow
				? !unchangedPublicContent
				: !isCompatibleMeaningfulEventRowHash(
						baseline?.publicContentHash,
						normalizedRow,
					);
			const firstSeenAt = eventKey
				? (baseline?.firstSeenAt ??
					firstSeenAtByEventKey.get(eventKey) ??
					defaultFirstSeenAt)
				: defaultFirstSeenAt;
			const lastMeaningfulChangeAt =
				baseline?.publicContentHash && hasMeaningfulChange
					? nowIso
					: (baseline?.lastMeaningfulChangeAt ?? firstSeenAt);
			return {
				id: randomUUID(),
				display_order: displayOrder,
				row_data: this.sql.json(normalizedRow),
				event_key: eventKey,
				first_seen_at: firstSeenAt,
				last_meaningful_change_at: lastMeaningfulChangeAt,
				public_content_hash: publicContentHash,
			};
		});
		if (rowRows.length > 0) {
			await this.sql`
				INSERT INTO app_event_store_rows ${this.sql(
					rowRows,
					"id",
					"display_order",
					"row_data",
					"event_key",
					"first_seen_at",
					"last_meaningful_change_at",
					"public_content_hash",
				)}
			`;
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

export const getEventSheetStoreRepository =
	(): EventSheetStoreRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (!globalThis.__ooocFeteFinderEventSheetStoreRepository) {
			globalThis.__ooocFeteFinderEventSheetStoreRepository =
				new EventSheetStoreRepository(sql);
		}

		return globalThis.__ooocFeteFinderEventSheetStoreRepository;
	};
