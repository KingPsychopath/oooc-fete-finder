import { NextRequest, NextResponse } from "next/server";
import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { EventsRuntimeManager } from "@/lib/cache/cache-manager";
import { processCSVData } from "@/features/data-management/data-processor";
import { DataManager } from "@/features/data-management/data-manager";
import { LocalEventStore } from "@/features/data-management/local-event-store";
import {
	getAppKVStoreRepository,
	getAppKVStoreTableName,
} from "@/lib/platform/postgres/app-kv-store-repository";
import { getEventSheetStoreRepository } from "@/lib/platform/postgres/event-sheet-store-repository";
import { isPostgresConfigured } from "@/lib/platform/postgres/postgres-client";

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	try {
		const kvRepository = getAppKVStoreRepository();
		const eventRepository = getEventSheetStoreRepository();
		const [storeStatus, csv, dataConfig, runtimeDataStatus, eventStoreCounts, eventStoreMeta] =
			await Promise.all([
			LocalEventStore.getStatus(),
			LocalEventStore.getCsv(),
			DataManager.getDataConfigStatus(),
			EventsRuntimeManager.getRuntimeDataStatus(),
			eventRepository?.getCounts() ??
				Promise.resolve({
					rowCount: 0,
					columnCount: 0,
				}),
			eventRepository?.getMeta() ??
				Promise.resolve({
					rowCount: 0,
					updatedAt: null,
					updatedBy: "unknown",
					origin: "manual",
					checksum: "",
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
		if (runtimeDataStatus.eventCount !== parsedEventCount) {
			mismatches.push(
				`Live runtime event count (${runtimeDataStatus.eventCount}) differs from parsed event count (${parsedEventCount}); runtime source may still be on fallback`,
			);
		}
		if (eventStoreMeta.rowCount !== eventStoreCounts.rowCount) {
			mismatches.push(
				`Postgres event tables disagree: meta rowCount (${eventStoreMeta.rowCount}) vs rows table count (${eventStoreCounts.rowCount})`,
			);
		}

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			connectivity: {
				postgresConfigured: isPostgresConfigured(),
				postgresTable: getAppKVStoreTableName(),
				postgresReachable: Boolean(kvRepository),
				eventStoreReachable: Boolean(eventRepository),
				storeProvider: storeStatus.provider,
				storeProviderLocation: storeStatus.providerLocation,
			},
			mode: {
				configuredDataMode: dataConfig.dataSource,
				liveDataSource: runtimeDataStatus.dataSource,
				remoteConfigured: dataConfig.remoteConfigured,
			},
			counts: {
				storeMetadataRows: storeStatus.rowCount,
				csvRawRows: csvRowCount,
				parsedEvents: parsedEventCount,
				liveRuntimeEvents: runtimeDataStatus.eventCount,
				liveEvents: runtimeDataStatus.eventCount,
			},
			store: {
				hasStoreData: storeStatus.hasStoreData,
				keyCount: storeStatus.keyCount,
				updatedAt: storeStatus.updatedAt,
				updatedBy: storeStatus.updatedBy,
				origin: storeStatus.origin,
				postgresEventTables: {
					rowCount: eventStoreCounts.rowCount,
					columnCount: eventStoreCounts.columnCount,
					meta: eventStoreMeta,
				},
			},
			warnings: {
				parsingWarnings,
				countMismatches: mismatches,
			},
			runtime: {
				lastCheckTime: runtimeDataStatus.lastFetchTime,
				lastErrorMessage: runtimeDataStatus.lastRemoteErrorMessage,
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
