import "server-only";

import { createHash } from "crypto";
import Papa from "papaparse";
import { CSV_EVENT_COLUMNS } from "./csv/parser";
import {
	csvToEditableSheet,
	editableSheetToCsv,
	type EditableSheetColumn,
	validateEditableSheet,
} from "./csv/sheet-editor";
import { getKVStore, getKVStoreInfo } from "@/lib/platform/kv/kv-store-factory";
import {
	getEventSheetStoreRepository,
	type EventStoreOrigin,
} from "@/lib/platform/postgres/event-sheet-store-repository";

const EVENTS_CSV_KEY = "events-store:csv";
const EVENTS_META_KEY = "events-store:meta";
const EVENTS_SETTINGS_KEY = "events-store:settings";

export interface EventStoreSettings {
	autoSyncFromGoogle: boolean;
	updatedAt: string;
}

interface EventStoreMetadata {
	rowCount: number;
	updatedAt: string;
	updatedBy: string;
	origin: EventStoreOrigin;
	checksum: string;
}

export interface EventStoreStatus {
	hasStoreData: boolean;
	rowCount: number;
	keyCount: number;
	updatedAt: string | null;
	updatedBy: string | null;
	origin: EventStoreMetadata["origin"] | null;
	autoSyncFromGoogle: boolean;
	provider: "file" | "memory" | "postgres";
	providerLocation: string;
}

type StorePreviewRow = Record<string, string>;
interface StorePreviewOptions {
	random?: boolean;
}

const DEFAULT_SETTINGS: EventStoreSettings = {
	autoSyncFromGoogle: false,
	updatedAt: new Date(0).toISOString(),
};

const parseJson = <T>(raw: string | null, fallback: T): T => {
	if (!raw) return fallback;
	try {
		const parsed = JSON.parse(raw) as T;
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
		return fallback;
	} catch {
		return fallback;
	}
};

const sanitizeCsv = (csvContent: string): string => {
	return csvContent.replace(/\r\n/g, "\n").trim();
};

const buildChecksum = (csvContent: string): string => {
	return createHash("sha256").update(csvContent).digest("hex").slice(0, 16);
};

const toEditableColumns = (
	columns: Array<{
		key: string;
		label: string;
		isCore: boolean;
		isRequired: boolean;
		displayOrder: number;
	}>,
): EditableSheetColumn[] =>
	columns
		.slice()
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.map((column) => ({
			key: column.key,
			label: column.label,
			isCore: column.isCore,
			isRequired: column.isRequired,
		}));

export class LocalEventStore {
	private static sampleRows<T>(rows: T[], count: number): T[] {
		if (rows.length <= count) {
			return rows.slice();
		}

		const shuffled = rows.slice();
		for (let index = shuffled.length - 1; index > 0; index -= 1) {
			const randomIndex = Math.floor(Math.random() * (index + 1));
			[shuffled[index], shuffled[randomIndex]] = [
				shuffled[randomIndex],
				shuffled[index],
			];
		}

		return shuffled.slice(0, count);
	}

	private static async isPostgresTableStoreMode(): Promise<boolean> {
		const providerInfo = await getKVStoreInfo();
		return providerInfo.provider === "postgres";
	}

	private static async migrateLegacyKvToPostgresTablesIfNeeded(): Promise<void> {
		if (!(await this.isPostgresTableStoreMode())) {
			return;
		}

		const repository = getEventSheetStoreRepository();
		if (!repository) {
			return;
		}

		const counts = await repository.getCounts();
		if (counts.rowCount > 0 || counts.columnCount > 0) {
			return;
		}

		const kv = await getKVStore();
		const legacyCsv = await kv.get(EVENTS_CSV_KEY);
		if (!legacyCsv || legacyCsv.trim().length === 0) {
			return;
		}

		const sheet = csvToEditableSheet(legacyCsv);
		const validation = validateEditableSheet(sheet.columns, sheet.rows);
		if (!validation.valid) {
			throw new Error(validation.error || "Failed to validate legacy event store");
		}

		const metaRaw = await kv.get(EVENTS_META_KEY);
		const legacyMeta = parseJson<Partial<EventStoreMetadata> | null>(metaRaw, null);
		const updatedBy =
			typeof legacyMeta?.updatedBy === "string" && legacyMeta.updatedBy.trim().length > 0 ?
				legacyMeta.updatedBy
			:	"legacy-kv-migration";
		const origin =
			legacyMeta?.origin === "manual" ||
			legacyMeta?.origin === "google-import" ||
			legacyMeta?.origin === "google-sync" ||
			legacyMeta?.origin === "local-file-import" ?
				legacyMeta.origin
			:	"manual";

		await repository.replaceSheet(
			validation.columns.map((column, index) => ({
				key: column.key,
				label: column.label,
				isCore: column.isCore,
				isRequired: column.isRequired,
				displayOrder: index,
			})),
			validation.rows,
			{
				updatedBy,
				origin,
				checksum: buildChecksum(legacyCsv),
			},
		);

		const legacySettingsRaw = await kv.get(EVENTS_SETTINGS_KEY);
		const legacySettings = parseJson<Partial<EventStoreSettings> | null>(
			legacySettingsRaw,
			null,
		);
		if (typeof legacySettings?.autoSyncFromGoogle === "boolean") {
			await repository.updateSettings({
				autoSyncFromGoogle: legacySettings.autoSyncFromGoogle,
			});
		}

		// Remove legacy event keys after successful migration to prevent stale dual sources.
		await kv.delete(EVENTS_CSV_KEY);
		await kv.delete(EVENTS_META_KEY);
		await kv.delete(EVENTS_SETTINGS_KEY);
	}

	private static async getLegacySettings(): Promise<EventStoreSettings> {
		const kv = await getKVStore();
		const raw = await kv.get(EVENTS_SETTINGS_KEY);
		const settings = parseJson<EventStoreSettings>(raw, DEFAULT_SETTINGS);

		return {
			autoSyncFromGoogle: Boolean(settings.autoSyncFromGoogle),
			updatedAt:
				typeof settings.updatedAt === "string" ?
					settings.updatedAt
				:	DEFAULT_SETTINGS.updatedAt,
		};
	}

	private static async updateLegacySettings(
		updates: Partial<Pick<EventStoreSettings, "autoSyncFromGoogle">>,
	): Promise<EventStoreSettings> {
		const kv = await getKVStore();
		const current = await this.getLegacySettings();
		const next: EventStoreSettings = {
			autoSyncFromGoogle:
				typeof updates.autoSyncFromGoogle === "boolean" ?
					updates.autoSyncFromGoogle
				:	current.autoSyncFromGoogle,
			updatedAt: new Date().toISOString(),
		};
		await kv.set(EVENTS_SETTINGS_KEY, JSON.stringify(next));
		return next;
	}

	static async getSettings(): Promise<EventStoreSettings> {
		if (await this.isPostgresTableStoreMode()) {
			await this.migrateLegacyKvToPostgresTablesIfNeeded();
			const repository = getEventSheetStoreRepository();
			if (repository) {
				return repository.getSettings();
			}
		}

		return this.getLegacySettings();
	}

	static async updateSettings(
		updates: Partial<Pick<EventStoreSettings, "autoSyncFromGoogle">>,
	): Promise<EventStoreSettings> {
		if (await this.isPostgresTableStoreMode()) {
			await this.migrateLegacyKvToPostgresTablesIfNeeded();
			const repository = getEventSheetStoreRepository();
			if (repository) {
				return repository.updateSettings(updates);
			}
		}

		return this.updateLegacySettings(updates);
	}

	static async getCsv(): Promise<string | null> {
		if (await this.isPostgresTableStoreMode()) {
			await this.migrateLegacyKvToPostgresTablesIfNeeded();
			const repository = getEventSheetStoreRepository();
			if (repository) {
				const sheet = await repository.getSheet();
				if (sheet.rows.length === 0 || sheet.columns.length === 0) {
					return null;
				}

				const editableColumns = toEditableColumns(sheet.columns);
				return editableSheetToCsv(editableColumns, sheet.rows);
			}
		}

		const kv = await getKVStore();
		return kv.get(EVENTS_CSV_KEY);
	}

	static async saveCsv(
		csvContent: string,
		meta: {
			updatedBy: string;
			origin: EventStoreMetadata["origin"];
		},
	): Promise<EventStoreMetadata> {
		const cleanedCsv = sanitizeCsv(csvContent);
		if (!cleanedCsv) {
			throw new Error("CSV content cannot be empty");
		}

		const sheet = csvToEditableSheet(cleanedCsv);
		const validation = validateEditableSheet(sheet.columns, sheet.rows);
		if (!validation.valid) {
			throw new Error(validation.error || "Invalid CSV content");
		}

		const record: EventStoreMetadata = {
			rowCount: validation.rows.length,
			updatedAt: new Date().toISOString(),
			updatedBy: meta.updatedBy,
			origin: meta.origin,
			checksum: buildChecksum(cleanedCsv),
		};

		if (await this.isPostgresTableStoreMode()) {
			await this.migrateLegacyKvToPostgresTablesIfNeeded();
			const repository = getEventSheetStoreRepository();
			if (repository) {
				const savedMeta = await repository.replaceSheet(
					validation.columns.map((column, index) => ({
						key: column.key,
						label: column.label,
						isCore: column.isCore,
						isRequired: column.isRequired,
						displayOrder: index,
					})),
					validation.rows,
					{
						updatedBy: record.updatedBy,
						origin: record.origin,
						checksum: record.checksum,
					},
				);

				return {
					rowCount: savedMeta.rowCount,
					updatedAt: savedMeta.updatedAt,
					updatedBy: savedMeta.updatedBy,
					origin: savedMeta.origin,
					checksum: savedMeta.checksum,
				};
			}
		}

		const kv = await getKVStore();
		await kv.set(EVENTS_CSV_KEY, cleanedCsv);
		await kv.set(EVENTS_META_KEY, JSON.stringify(record));
		return record;
	}

	static async clearCsv(): Promise<void> {
		if (await this.isPostgresTableStoreMode()) {
			await this.migrateLegacyKvToPostgresTablesIfNeeded();
			const repository = getEventSheetStoreRepository();
			if (repository) {
				await repository.clearSheet();
				return;
			}
		}

		const kv = await getKVStore();
		await kv.delete(EVENTS_CSV_KEY);
		await kv.delete(EVENTS_META_KEY);
	}

	static async getPreview(
		limit = 20,
		options?: StorePreviewOptions,
	): Promise<{
		headers: readonly string[];
		rows: StorePreviewRow[];
	}> {
		const csv = await this.getCsv();
		if (!csv) {
			return { headers: CSV_EVENT_COLUMNS, rows: [] };
		}

		const parseResult = Papa.parse<Record<string, string>>(csv, {
			header: true,
			skipEmptyLines: "greedy",
			transform: (value: string) => value.trim(),
		});
		const headers = parseResult.meta.fields || CSV_EVENT_COLUMNS;
		const normalizedLimit = Math.max(1, Math.min(limit, 100));
		const sourceRows =
			options?.random ?
				this.sampleRows(parseResult.data, normalizedLimit)
			:	parseResult.data.slice(0, normalizedLimit);

		const rows = sourceRows.map((row) => {
			const normalizedRow: StorePreviewRow = {};
			for (const header of headers) {
				normalizedRow[header] = row[header] ?? "";
			}
			return normalizedRow;
		});

		return {
			headers,
			rows,
		};
	}

	static async getStatus(): Promise<EventStoreStatus> {
		const providerInfo = await getKVStoreInfo();
		const settings = await this.getSettings();

		if (providerInfo.provider === "postgres") {
			await this.migrateLegacyKvToPostgresTablesIfNeeded();
			const repository = getEventSheetStoreRepository();
			if (repository) {
				const [meta, counts] = await Promise.all([
					repository.getMeta(),
					repository.getCounts(),
				]);

				return {
					hasStoreData: counts.rowCount > 0,
					rowCount: counts.rowCount,
					keyCount: counts.rowCount + counts.columnCount + 2,
					updatedAt: meta.updatedAt,
					updatedBy: meta.updatedBy,
					origin: meta.origin,
					autoSyncFromGoogle: settings.autoSyncFromGoogle,
					provider: "postgres",
					providerLocation: repository.getStorageLocation(),
				};
			}
		}

		const kv = await getKVStore();
		const keys = await kv.list();
		const csv = await kv.get(EVENTS_CSV_KEY);
		const metaRaw = await kv.get(EVENTS_META_KEY);
		const meta = parseJson<EventStoreMetadata | null>(metaRaw, null);

		return {
			hasStoreData: Boolean(csv),
			rowCount: meta?.rowCount ?? 0,
			keyCount: keys.length,
			updatedAt: meta?.updatedAt ?? null,
			updatedBy: meta?.updatedBy ?? null,
			origin: meta?.origin ?? null,
			autoSyncFromGoogle: settings.autoSyncFromGoogle,
			provider: providerInfo.provider,
			providerLocation: providerInfo.location,
		};
	}
}
