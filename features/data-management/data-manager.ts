/**
 * Data management orchestration.
 *
 * Generic source pipeline with explicit source priority and fallback reasons.
 */

import { env } from "@/lib/config/env";
import { Event } from "@/features/events/types";
import { fetchLocalCSV } from "./csv/fetcher";
import { isValidEventsData, processCSVData } from "./data-processor";
import { LocalEventStore } from "./local-event-store";

export type ConfiguredDataMode = "remote" | "local" | "test";

type LiveDataSource = "remote" | "local" | "store" | "test";

export interface DataManagerResult {
	success: boolean;
	data: Event[];
	count: number;
	source: LiveDataSource;
	error?: string;
	warnings: string[];
	lastUpdate?: string;
}

interface SourceAttemptSuccess {
	success: true;
	events: Event[];
	count: number;
	source: LiveDataSource;
	warnings: string[];
	lastUpdate: string;
}

interface SourceAttemptFailure {
	success: false;
	reason: string;
	warnings: string[];
}

type SourceAttemptResult = SourceAttemptSuccess | SourceAttemptFailure;

interface DataReadOptions {
	populateCoordinates?: boolean;
}

interface SourceDescriptor {
	id: LiveDataSource;
	load: (
		warnings: string[],
		options?: DataReadOptions,
	) => Promise<SourceAttemptResult>;
}

const isSourceAttemptSuccess = (
	result: SourceAttemptResult,
): result is SourceAttemptSuccess => result.success;

const toFailure = (reason: string, warnings: string[] = []): SourceAttemptFailure => ({
	success: false,
	reason,
	warnings,
});

const validateProcessedEvents = (
	events: Event[],
	count: number,
	source: LiveDataSource,
	errors: string[],
): SourceAttemptResult => {
	if (count === 0 || events.length === 0) {
		return toFailure(`${source} returned no rows`, errors);
	}

	if (!isValidEventsData(events)) {
		return toFailure(`${source} returned invalid events`, errors);
	}

	return {
		success: true,
		events,
		count,
		source,
		warnings: errors,
		lastUpdate: new Date().toISOString(),
	};
};

const loadFromStore: SourceDescriptor = {
	id: "store",
	async load(_warnings, options) {
		try {
			const storeCsv = await LocalEventStore.getCsv();
			if (!storeCsv) {
				return toFailure("Managed store unavailable or empty");
			}

			const parsed = await processCSVData(storeCsv, "store", false, {
				populateCoordinates: options?.populateCoordinates ?? true,
			});

			const validation = validateProcessedEvents(
				parsed.events,
				parsed.count,
				"store",
				parsed.errors,
			);
			if (!isSourceAttemptSuccess(validation)) {
				return toFailure(validation.reason, parsed.errors);
			}

			return {
				...validation,
				source: "store",
			};
		} catch (error) {
			return toFailure(
				`Managed store failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	},
};

const loadFromLocal: SourceDescriptor = {
	id: "local",
	async load(_warnings, options) {
		try {
			const localCsv = await fetchLocalCSV();
			const parsed = await processCSVData(localCsv, "local", false, {
				populateCoordinates: options?.populateCoordinates ?? false,
			});
			const validation = validateProcessedEvents(
				parsed.events,
				parsed.count,
				"local",
				parsed.errors,
			);
			if (!isSourceAttemptSuccess(validation)) {
				return toFailure(validation.reason, parsed.errors);
			}

			return {
				...validation,
				source: "local",
			};
		} catch (error) {
			return toFailure(
				`Local CSV fallback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	},
};

const runSourceChain = async (
	sources: SourceDescriptor[],
	startingWarnings: string[] = [],
	options?: DataReadOptions,
): Promise<DataManagerResult> => {
	const warnings = [...startingWarnings];

	for (const source of sources) {
		const result = await source.load(warnings, options);
		if (isSourceAttemptSuccess(result)) {
			return {
				success: true,
				data: result.events,
				count: result.count,
				source: result.source,
				warnings: [...warnings, ...result.warnings],
				lastUpdate: result.lastUpdate,
			};
		}

		warnings.push(result.reason, ...result.warnings);
	}

	return {
		success: false,
		data: [],
		count: 0,
		source: sources[sources.length - 1]?.id ?? "local",
		error: warnings[0] ?? "No data source succeeded",
		warnings,
	};
};

const runTestMode = async (): Promise<DataManagerResult> => {
	const { EVENTS_DATA } = await import("@/data/events");
	return {
		success: true,
		data: EVENTS_DATA,
		count: EVENTS_DATA.length,
		source: "test",
		warnings: [],
		lastUpdate: new Date().toISOString(),
	};
};

export class DataManager {
	static async getEventsData(options?: DataReadOptions): Promise<DataManagerResult> {
		const configuredMode = env.DATA_MODE as ConfiguredDataMode;

		if (configuredMode === "test") {
			return runTestMode();
		}

		if (configuredMode === "local") {
			return runSourceChain([loadFromLocal], [], options);
		}

		// Remote mode pipeline:
		// 1) managed store
		// 2) local CSV stale-safe fallback
		const result = await runSourceChain([loadFromStore, loadFromLocal], [], options);
		if (result.success && result.source === "local") {
			return {
				...result,
				warnings: [
					"Managed store unavailable; serving local CSV fallback (stale-safe mode).",
					...result.warnings,
				],
			};
		}

		return result;
	}

	static async getDataConfigStatus(): Promise<{
		dataSource: ConfiguredDataMode;
		remoteConfigured: boolean;
		localCsvLastUpdated: string;
		hasServiceAccount: boolean;
		hasDynamicOverride: boolean;
		hasLocalStoreData: boolean;
		storeProvider: "file" | "memory" | "postgres";
		storeProviderLocation: string;
		storeRowCount: number;
		storeUpdatedAt: string | null;
		storeKeyCount: number;
	}> {
		const hasServiceAccount = Boolean(
			env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_FILE,
		);
		const storeStatus = await LocalEventStore.getStatus();

		const remoteConfigured = Boolean(env.DATABASE_URL || storeStatus.hasStoreData);

		return {
			dataSource: env.DATA_MODE as ConfiguredDataMode,
			remoteConfigured,
			localCsvLastUpdated: env.LOCAL_CSV_LAST_UPDATED || "unknown",
			hasServiceAccount,
			hasDynamicOverride: false,
			hasLocalStoreData: storeStatus.hasStoreData,
			storeProvider: storeStatus.provider,
			storeProviderLocation: storeStatus.providerLocation,
			storeRowCount: storeStatus.rowCount,
			storeUpdatedAt: storeStatus.updatedAt,
			storeKeyCount: storeStatus.keyCount,
		};
	}
}
