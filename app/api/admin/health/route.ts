import { NextRequest, NextResponse } from "next/server";
import { validateAdminKeyForApiRoute } from "@/lib/admin/admin-validation";
import { CacheManager } from "@/lib/cache-management/cache-manager";
import { processCSVData } from "@/lib/data-management/data-processor";
import { DataManager } from "@/lib/data-management/data-manager";
import { LocalEventStore } from "@/lib/data-management/local-event-store";
import {
	getAppKVStoreRepository,
	getAppKVStoreTableName,
} from "@/lib/platform/postgres/app-kv-store-repository";
import { isPostgresConfigured } from "@/lib/platform/postgres/postgres-client";

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	try {
		const repository = getAppKVStoreRepository();
		const [storeStatus, csv, dataConfig, cacheStatus, eventsStats] =
			await Promise.all([
			LocalEventStore.getStatus(),
			LocalEventStore.getCsv(),
			DataManager.getDataConfigStatus(),
			CacheManager.getCacheStatus(),
			repository?.getEventsStoreStats() ??
				Promise.resolve({
					hasCsv: false,
					hasMeta: false,
					metadataRowCount: 0,
					rawCsvRowCount: 0,
					rowCountMatches: true,
					metadataUpdatedAt: null,
				}),
		]);

		const csvLineCount =
			csv ?
				csv
					.split("\n")
					.map((line) => line.trim())
					.filter((line) => line.length > 0).length
			: 0;
		const csvRowCount = Math.max(0, csvLineCount - 1);

		let parsedEventCount = 0;
		let parsingWarnings: string[] = [];
		if (csv) {
			const parsed = await processCSVData(csv, "store", false, {
				populateCoordinates: false,
			});
			parsedEventCount = parsed.count;
			parsingWarnings = parsed.errors;
		}

		const mismatches: string[] = [];
		if (storeStatus.rowCount !== csvRowCount) {
			mismatches.push(
				`Metadata rowCount (${storeStatus.rowCount}) differs from raw CSV rows (${csvRowCount})`,
			);
		}
		if (parsedEventCount !== csvRowCount) {
			mismatches.push(
				`Parsed event count (${parsedEventCount}) differs from raw CSV rows (${csvRowCount}); this usually means rows were filtered/invalid during parsing`,
			);
		}
		if (cacheStatus.eventCount !== parsedEventCount) {
			mismatches.push(
				`Live cache event count (${cacheStatus.eventCount}) differs from parsed event count (${parsedEventCount}); cache may be stale or using a fallback source`,
			);
		}
		if (!eventsStats.rowCountMatches) {
			mismatches.push(
				`Postgres events-store keys disagree: meta rowCount (${eventsStats.metadataRowCount}) vs CSV raw rows (${eventsStats.rawCsvRowCount})`,
			);
		}

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			connectivity: {
				postgresConfigured: isPostgresConfigured(),
				postgresTable: getAppKVStoreTableName(),
				postgresReachable: Boolean(repository),
				storeProvider: storeStatus.provider,
				storeProviderLocation: storeStatus.providerLocation,
			},
			mode: {
				configuredDataMode: dataConfig.dataSource,
				liveDataSource: cacheStatus.dataSource,
				remoteConfigured: dataConfig.remoteConfigured,
			},
			counts: {
				storeMetadataRows: storeStatus.rowCount,
				csvRawRows: csvRowCount,
				parsedEvents: parsedEventCount,
				liveCachedEvents: cacheStatus.eventCount,
			},
			store: {
				hasStoreData: storeStatus.hasStoreData,
				keyCount: storeStatus.keyCount,
				updatedAt: storeStatus.updatedAt,
				updatedBy: storeStatus.updatedBy,
				origin: storeStatus.origin,
				postgresEventsStore: eventsStats,
			},
			warnings: {
				parsingWarnings,
				countMismatches: mismatches,
			},
			cache: {
				lastFetchTime: cacheStatus.lastFetchTime,
				cacheAgeMs: cacheStatus.cacheAge,
				lastRemoteErrorMessage: cacheStatus.lastRemoteErrorMessage,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
