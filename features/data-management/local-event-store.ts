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
import {
	getEventSheetStoreRepository,
	type EventStoreOrigin,
	type EventSheetColumnRecord,
	type EventSheetRowRecord,
} from "@/lib/platform/postgres/event-sheet-store-repository";

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
	provider: "file" | "memory" | "postgres";
	providerLocation: string;
}

type StorePreviewRow = Record<string, string>;
interface StorePreviewOptions {
	random?: boolean;
}

type SaveCsvMeta = {
	updatedBy: string;
	origin: EventStoreMetadata["origin"];
};

interface EventStoreAdapter {
	getCsv(): Promise<string | null>;
	saveCsv(csvContent: string, meta: SaveCsvMeta): Promise<EventStoreMetadata>;
	clearCsv(): Promise<void>;
	getStatus(): Promise<EventStoreStatus>;
}

const DEFAULT_META: EventStoreMetadata = {
	rowCount: 0,
	updatedAt: new Date(0).toISOString(),
	updatedBy: "system",
	origin: "manual",
	checksum: "",
};

const sanitizeCsv = (csvContent: string): string =>
	csvContent.replace(/\r\n/g, "\n").trim();

const buildChecksum = (csvContent: string): string =>
	createHash("sha256").update(csvContent).digest("hex").slice(0, 16);

const toEditableColumns = (
	columns: EventSheetColumnRecord[],
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

const toRepositoryColumns = (
	columns: EditableSheetColumn[],
): EventSheetColumnRecord[] =>
	columns.map((column, index) => ({
		key: column.key,
		label: column.label,
		isCore: column.isCore,
		isRequired: column.isRequired,
		displayOrder: index,
	}));

const sampleRows = <T>(rows: T[], count: number): T[] => {
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
};

const parseCsvPreview = (
	csv: string,
	limit: number,
	options?: StorePreviewOptions,
): {
	headers: readonly string[];
	rows: StorePreviewRow[];
} => {
	const parseResult = Papa.parse<Record<string, string>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
		transform: (value: string) => value.trim(),
	});
	const headers = parseResult.meta.fields || CSV_EVENT_COLUMNS;
	const normalizedLimit = Math.max(1, Math.min(limit, 100));
	const sourceRows =
		options?.random ?
			sampleRows(parseResult.data, normalizedLimit)
		: 	parseResult.data.slice(0, normalizedLimit);

	const rows = sourceRows.map((row) => {
		const normalizedRow: StorePreviewRow = {};
		for (const header of headers) {
			normalizedRow[header] = row[header] ?? "";
		}
		return normalizedRow;
	});

	return { headers, rows };
};

class PostgresEventStoreAdapter implements EventStoreAdapter {
	private get repository() {
		return getEventSheetStoreRepository();
	}

	private ensureRepository() {
		const repository = this.repository;
		if (!repository) {
			throw new Error("Postgres store is unavailable. Set DATABASE_URL.");
		}
		return repository;
	}

	async getCsv(): Promise<string | null> {
		const sheet = await this.ensureRepository().getSheet();
		if (sheet.rows.length === 0 || sheet.columns.length === 0) {
			return null;
		}
		return editableSheetToCsv(toEditableColumns(sheet.columns), sheet.rows);
	}

	async saveCsv(csvContent: string, meta: SaveCsvMeta): Promise<EventStoreMetadata> {
		const cleanedCsv = sanitizeCsv(csvContent);
		if (!cleanedCsv) {
			throw new Error("CSV content cannot be empty");
		}

		const sheet = csvToEditableSheet(cleanedCsv);
		const validation = validateEditableSheet(sheet.columns, sheet.rows);
		if (!validation.valid) {
			throw new Error(validation.error || "Invalid CSV content");
		}

		const checksum = buildChecksum(cleanedCsv);
		const savedMeta = await this.ensureRepository().replaceSheet(
			toRepositoryColumns(validation.columns),
			validation.rows,
			{
				updatedBy: meta.updatedBy,
				origin: meta.origin,
				checksum,
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

	async clearCsv(): Promise<void> {
		await this.ensureRepository().clearSheet();
	}

	async getStatus(): Promise<EventStoreStatus> {
		const repository = this.repository;
		if (!repository) {
			return {
				hasStoreData: false,
				rowCount: 0,
				keyCount: 0,
				updatedAt: null,
				updatedBy: null,
				origin: null,
				provider: "memory",
				providerLocation: "Postgres unavailable (DATABASE_URL not configured)",
			};
		}

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
			provider: "postgres",
			providerLocation: repository.getStorageLocation(),
		};
	}
}

declare global {
	var __ooocFeteFinderMemoryEventStoreData:
		| {
			columns: EventSheetColumnRecord[];
			rows: EventSheetRowRecord[];
			meta: EventStoreMetadata;
		}
		| undefined;
}

class MemoryEventStoreAdapter implements EventStoreAdapter {
	private readonly providerLocation = "in-memory event store fallback";

	private get state() {
		if (!globalThis.__ooocFeteFinderMemoryEventStoreData) {
			globalThis.__ooocFeteFinderMemoryEventStoreData = {
				columns: CSV_EVENT_COLUMNS.map((column, index) => ({
					key: column,
					label: column,
					isCore: true,
					isRequired: false,
					displayOrder: index,
				})),
				rows: [],
				meta: DEFAULT_META,
			};
		}

		return globalThis.__ooocFeteFinderMemoryEventStoreData;
	}

	async getCsv(): Promise<string | null> {
		if (this.state.rows.length === 0) {
			return null;
		}
		return editableSheetToCsv(toEditableColumns(this.state.columns), this.state.rows);
	}

	async saveCsv(csvContent: string, meta: SaveCsvMeta): Promise<EventStoreMetadata> {
		const cleanedCsv = sanitizeCsv(csvContent);
		if (!cleanedCsv) {
			throw new Error("CSV content cannot be empty");
		}

		const sheet = csvToEditableSheet(cleanedCsv);
		const validation = validateEditableSheet(sheet.columns, sheet.rows);
		if (!validation.valid) {
			throw new Error(validation.error || "Invalid CSV content");
		}

		const now = new Date().toISOString();
		this.state.columns = toRepositoryColumns(validation.columns);
		this.state.rows = validation.rows;
		this.state.meta = {
			rowCount: validation.rows.length,
			updatedAt: now,
			updatedBy: meta.updatedBy,
			origin: meta.origin,
			checksum: buildChecksum(cleanedCsv),
		};
		return this.state.meta;
	}

	async clearCsv(): Promise<void> {
		this.state.rows = [];
		this.state.meta = {
			...DEFAULT_META,
			updatedAt: new Date().toISOString(),
		};
	}

	async getStatus(): Promise<EventStoreStatus> {
		return {
			hasStoreData: this.state.rows.length > 0,
			rowCount: this.state.rows.length,
			keyCount: this.state.rows.length + this.state.columns.length + 2,
			updatedAt: this.state.meta.updatedAt,
			updatedBy: this.state.meta.updatedBy,
			origin: this.state.meta.origin,
			provider: "memory",
			providerLocation: this.providerLocation,
		};
	}
}

const postgresAdapter = new PostgresEventStoreAdapter();
const memoryAdapter = new MemoryEventStoreAdapter();

const resolveAdapter = (): EventStoreAdapter => {
	return getEventSheetStoreRepository() ? postgresAdapter : memoryAdapter;
};

export class LocalEventStore {
	private static adapter(): EventStoreAdapter {
		return resolveAdapter();
	}

	static async getCsv(): Promise<string | null> {
		return this.adapter().getCsv();
	}

	static async saveCsv(csvContent: string, meta: SaveCsvMeta): Promise<EventStoreMetadata> {
		return this.adapter().saveCsv(csvContent, meta);
	}

	static async clearCsv(): Promise<void> {
		return this.adapter().clearCsv();
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

		return parseCsvPreview(csv, limit, options);
	}

	static async getStatus(): Promise<EventStoreStatus> {
		return this.adapter().getStatus();
	}
}
