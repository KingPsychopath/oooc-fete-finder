/**
 * Data Management Module
 *
 * Centralized orchestration for event data loading with source fallbacks.
 */

import { env } from "@/lib/config/env";
import { Event } from "@/types/events";
import { fetchRemoteCSV } from "./csv/fetcher";
import { processCSVData } from "./data-processor";
import { DynamicSheetManager } from "./dynamic-sheet-manager";
import { LocalEventStore } from "./local-event-store";

export type ConfiguredDataMode = "remote" | "local" | "test";

export interface DataManagerResult {
	success: boolean;
	data: Event[];
	count: number;
	source: "remote" | "local" | "store" | "test";
	cached: boolean;
	error?: string;
	warnings: string[];
	lastUpdate?: string;
}

export class DataManager {
	private static async tryStoreData(
		warnings: string[],
	): Promise<DataManagerResult | null> {
		const storeCsv = await LocalEventStore.getCsv();
		if (!storeCsv) {
			return null;
		}

		const storeResult = await processCSVData(storeCsv, "store", false, {
			populateCoordinates: false,
		});

		if (storeResult.count === 0 || storeResult.events.length === 0) {
			return null;
		}

		return {
			success: true,
			data: storeResult.events,
			count: storeResult.count,
			source: "store",
			cached: false,
			warnings: [...warnings, ...storeResult.errors],
			lastUpdate: new Date().toISOString(),
		};
	}

	static async getEventsData(): Promise<DataManagerResult> {
		const warnings: string[] = [];
		const configuredMode = env.DATA_MODE as ConfiguredDataMode;

		try {
			if (configuredMode === "test") {
				const { EVENTS_DATA } = await import("@/data/events");
				return {
					success: true,
					data: EVENTS_DATA,
					count: EVENTS_DATA.length,
					source: "test",
					cached: false,
					warnings,
					lastUpdate: new Date().toISOString(),
				};
			}

			if (configuredMode === "local") {
				const { fetchLocalCSV } = await import("./csv/fetcher");
				const localCsv = await fetchLocalCSV();
				const localResult = await processCSVData(localCsv, "local", false, {
					populateCoordinates: false,
				});

				return {
					success: true,
					data: localResult.events,
					count: localResult.count,
					source: "local",
					cached: false,
					warnings: localResult.errors,
					lastUpdate: new Date().toISOString(),
				};
			}

			// Remote mode: Postgres/provider-backed store is always first-class.
			// If store is unavailable/empty, we fall back to remote CSV sources.
			const storeFirstResult = await this.tryStoreData(warnings);
			if (storeFirstResult) {
				console.log("💾 Using managed event store (remote mode, store-priority)");
				return storeFirstResult;
			}
			const storeSettings = await LocalEventStore.getSettings();

			const effectiveConfig = DynamicSheetManager.getEffectiveConfig(
				env.GOOGLE_SHEET_ID,
				"A:Z",
			);

			let remoteUrl: string | null = null;
			let sheetId: string | null = effectiveConfig.sheetId;
			const range = effectiveConfig.range || "A:Z";

			if (effectiveConfig.isDynamic && effectiveConfig.sheetId) {
				const { GoogleCloudAPI } = await import("../google/api");
				remoteUrl = GoogleCloudAPI.buildSheetsUrl(effectiveConfig.sheetId, range);
			} else {
				remoteUrl = env.REMOTE_CSV_URL || null;
				if (!sheetId && remoteUrl) {
					const { GoogleCloudAPI } = await import("../google/api");
					sheetId = GoogleCloudAPI.extractSheetId(remoteUrl);
				}
			}

			const remoteFetchResult = await fetchRemoteCSV(remoteUrl, sheetId, range);
			const processed = await processCSVData(
				remoteFetchResult.content,
				remoteFetchResult.source,
				false,
				{
					coordinateBatchSize: 5,
					populateCoordinates: false,
					onCoordinateProgress: (processedCount, total, currentEvent) => {
						if (processedCount % 10 === 0 || processedCount === total) {
							console.log(
								`🗺️ Geocoding progress: ${processedCount}/${total} (${currentEvent.name})`,
							);
						}
					},
				},
			);

			warnings.push(...processed.errors);

			if (
				remoteFetchResult.source === "remote" &&
				storeSettings.autoSyncFromGoogle &&
				processed.count > 0
			) {
				try {
					await LocalEventStore.saveCsv(remoteFetchResult.content, {
						updatedBy: "system-google-sync",
						origin: "google-sync",
					});
				} catch (syncError) {
					warnings.push(
						`Failed to sync Google data to managed store: ${
							syncError instanceof Error ? syncError.message : "Unknown error"
						}`,
					);
				}
			}

			const { isValidEventsData } = await import("./data-processor");
			if (isValidEventsData(processed.events)) {
				return {
					success: true,
					data: processed.events,
					count: processed.count,
					source: processed.source,
					cached: false,
					warnings,
					lastUpdate: new Date(remoteFetchResult.timestamp).toISOString(),
				};
			}

			const storeFallback = await this.tryStoreData(warnings);
			if (storeFallback) {
				storeFallback.warnings.push(
					"Remote data invalid - using managed store fallback",
				);
				return storeFallback;
			}

			return {
				success: false,
				data: [],
				count: 0,
				source: "remote",
				cached: false,
				error: "Remote data validation failed",
				warnings,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			const storeFallback = await this.tryStoreData(warnings);
			if (storeFallback) {
				storeFallback.warnings.push(
					`Primary data source failed (${errorMessage}) - using managed store fallback`,
				);
				return storeFallback;
			}

			return {
				success: false,
				data: [],
				count: 0,
				source: "local",
				cached: false,
				error: errorMessage,
				warnings,
			};
		}
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

		const remoteConfigured = Boolean(
			env.REMOTE_CSV_URL ||
				env.GOOGLE_SHEETS_API_KEY ||
				hasServiceAccount ||
				DynamicSheetManager.hasDynamicOverride(),
		);

		return {
			dataSource: env.DATA_MODE as ConfiguredDataMode,
			remoteConfigured,
			localCsvLastUpdated: env.LOCAL_CSV_LAST_UPDATED || "unknown",
			hasServiceAccount,
			hasDynamicOverride: DynamicSheetManager.hasDynamicOverride(),
			hasLocalStoreData: storeStatus.hasStoreData,
			storeProvider: storeStatus.provider,
			storeProviderLocation: storeStatus.providerLocation,
			storeRowCount: storeStatus.rowCount,
			storeUpdatedAt: storeStatus.updatedAt,
			storeKeyCount: storeStatus.keyCount,
		};
	}
}
