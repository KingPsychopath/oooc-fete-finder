/**
 * Data Management Module
 *
 * Centralized orchestration for event data loading with source fallbacks.
 */

import { env } from "@/lib/config/env";
import { Event } from "@/features/events/types";
import { fetchLocalCSV, fetchRemoteCSV } from "./csv/fetcher";
import { isValidEventsData, processCSVData } from "./data-processor";
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
			populateCoordinates: true,
		});

		if (
			storeResult.count === 0 ||
			storeResult.events.length === 0 ||
			!isValidEventsData(storeResult.events)
		) {
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

	private static async tryLocalCsvFallback(
		warnings: string[],
		reason: string,
	): Promise<DataManagerResult | null> {
		try {
			const localCsv = await fetchLocalCSV();
			const localResult = await processCSVData(localCsv, "local", false, {
				populateCoordinates: false,
			});

			if (
				localResult.count === 0 ||
				localResult.events.length === 0 ||
				!isValidEventsData(localResult.events)
			) {
				return null;
			}

			return {
				success: true,
				data: localResult.events,
				count: localResult.count,
				source: "local",
				cached: false,
				warnings: [reason, ...warnings, ...localResult.errors],
				lastUpdate: new Date().toISOString(),
			};
		} catch (error) {
			warnings.push(
				`Local CSV fallback failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
			return null;
		}
	}

	private static async tryRemoteData(
		warnings: string[],
	): Promise<DataManagerResult | null> {
		const remoteUrl = env.REMOTE_CSV_URL || null;
		const sheetId = env.GOOGLE_SHEET_ID || null;
		if (!remoteUrl && !sheetId) {
			warnings.push(
				"Remote source not configured (set REMOTE_CSV_URL or GOOGLE_SHEET_ID)",
			);
			return null;
		}

		try {
			const remoteFetchResult = await fetchRemoteCSV(remoteUrl, sheetId, "A:Z", {
				allowLocalFallback: false,
			});
			const remoteResult = await processCSVData(
				remoteFetchResult.content,
				"remote",
				false,
				{ populateCoordinates: true },
			);

			if (
				remoteResult.count === 0 ||
				remoteResult.events.length === 0 ||
				!isValidEventsData(remoteResult.events)
			) {
				warnings.push("Remote source returned empty or invalid data");
				return null;
			}

			return {
				success: true,
				data: remoteResult.events,
				count: remoteResult.count,
				source: "remote",
				cached: false,
				warnings: [...warnings, ...remoteResult.errors],
				lastUpdate: new Date(remoteFetchResult.timestamp).toISOString(),
			};
		} catch (error) {
			warnings.push(
				`Remote source failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
			return null;
		}
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

			// Remote mode contract:
			// 1) Primary: managed store (Postgres-backed when DATABASE_URL configured)
			// 2) Secondary: remote CSV/Google Sheets source
			// 3) Fallback: local CSV file (stale-safe backup)
			const storeFirstResult = await this.tryStoreData(warnings);
			if (storeFirstResult) {
				return storeFirstResult;
			}

			const remoteResult = await this.tryRemoteData(warnings);
			if (remoteResult) {
				return remoteResult;
			}

			const localFallback = await this.tryLocalCsvFallback(
				warnings,
				"Managed store and remote source unavailable; serving local CSV fallback (stale-safe mode).",
			);
			if (localFallback) {
				return localFallback;
			}

			return {
				success: false,
				data: [],
				count: 0,
				source: "store",
				cached: false,
				error:
					"Managed store/remote source unavailable and local CSV fallback could not be loaded",
				warnings,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const localFallback = await this.tryLocalCsvFallback(
				warnings,
				`Managed store failed (${errorMessage}); serving local CSV fallback (stale-safe mode).`,
			);
			if (localFallback) {
				return localFallback;
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
		const hasRemoteSource = Boolean(
			(env.REMOTE_CSV_URL && env.REMOTE_CSV_URL.trim()) ||
				(env.GOOGLE_SHEET_ID && env.GOOGLE_SHEET_ID.trim()),
		);
		const storeStatus = await LocalEventStore.getStatus();

		const remoteConfigured = Boolean(
			env.DATABASE_URL || storeStatus.hasStoreData || hasRemoteSource,
		);

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
