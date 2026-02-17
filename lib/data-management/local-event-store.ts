import "server-only";

import { createHash } from "crypto";
import Papa from "papaparse";
import type { CSVEventRow } from "./csv/parser";
import { CSV_EVENT_COLUMNS, parseCSVContent } from "./csv/parser";
import { getKVStore, getKVStoreInfo } from "@/lib/platform/kv/kv-store-factory";

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
	origin: "manual" | "google-import" | "google-sync" | "local-file-import";
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

const countRows = (rows: CSVEventRow[]): number => rows.length;

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

	static async getSettings(): Promise<EventStoreSettings> {
		const kv = await getKVStore();
		const raw = await kv.get(EVENTS_SETTINGS_KEY);
		const settings = parseJson<EventStoreSettings>(raw, DEFAULT_SETTINGS);

		return {
			autoSyncFromGoogle: Boolean(settings.autoSyncFromGoogle),
			updatedAt:
				typeof settings.updatedAt === "string"
					? settings.updatedAt
					: DEFAULT_SETTINGS.updatedAt,
		};
	}

	static async updateSettings(
		updates: Partial<Pick<EventStoreSettings, "autoSyncFromGoogle">>,
	): Promise<EventStoreSettings> {
		const kv = await getKVStore();
		const current = await this.getSettings();
		const next: EventStoreSettings = {
			autoSyncFromGoogle:
				typeof updates.autoSyncFromGoogle === "boolean"
					? updates.autoSyncFromGoogle
					: current.autoSyncFromGoogle,
			updatedAt: new Date().toISOString(),
		};
		await kv.set(EVENTS_SETTINGS_KEY, JSON.stringify(next));
		return next;
	}

	static async getCsv(): Promise<string | null> {
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

		const parsedRows = parseCSVContent(cleanedCsv);
		const record: EventStoreMetadata = {
			rowCount: countRows(parsedRows),
			updatedAt: new Date().toISOString(),
			updatedBy: meta.updatedBy,
			origin: meta.origin,
			checksum: buildChecksum(cleanedCsv),
		};

		const kv = await getKVStore();
		await kv.set(EVENTS_CSV_KEY, cleanedCsv);
		await kv.set(EVENTS_META_KEY, JSON.stringify(record));
		return record;
	}

	static async clearCsv(): Promise<void> {
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

		const rows = sourceRows
			.map((row) => {
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
		const kv = await getKVStore();
		const providerInfo = await getKVStoreInfo();
		const settings = await this.getSettings();

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
