import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { csvToEditableSheet } from "@/features/data-management/csv/sheet-editor";
import { DataManager } from "@/features/data-management/data-manager";
import { processCSVData } from "@/features/data-management/data-processor";
import { LocalEventStore } from "@/features/data-management/local-event-store";
import { getRuntimeDataStatusFromSource } from "@/features/data-management/runtime-service";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	getAppKVStoreRepository,
	getAppKVStoreTableName,
} from "@/lib/platform/postgres/app-kv-store-repository";
import { getEventSheetStoreRepository } from "@/lib/platform/postgres/event-sheet-store-repository";
import { isPostgresConfigured } from "@/lib/platform/postgres/postgres-client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const kvRepository = getAppKVStoreRepository();
		const eventRepository = getEventSheetStoreRepository();
		const [
			storeStatus,
			csv,
			dataConfig,
			runtimeDataStatus,
			freshDataStatus,
			eventStoreCounts,
			eventStoreMeta,
		] = await Promise.all([
			LocalEventStore.getStatus(),
			LocalEventStore.getCsv(),
			DataManager.getDataConfigStatus(),
			getRuntimeDataStatusFromSource(),
			DataManager.getEventsData({ populateCoordinates: false }),
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

		const sheet = csv?.trim() ? csvToEditableSheet(csv) : null;
		const csvRowCount = sheet?.rows.length ?? 0;
		const csvPublishableRowCount =
			sheet?.rows.filter(
				(row) =>
					String(row.detailsQualityOverride ?? "").trim().toLowerCase() !==
					"draft",
			).length ?? 0;

		let parsedEventCount = 0;
		let parsingWarnings: string[] = [];
		if (csv?.trim()) {
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
		if (parsedEventCount !== csvPublishableRowCount) {
			mismatches.push(
				`Parsed event count (${parsedEventCount}) differs from publishable CSV rows (${csvPublishableRowCount}); this usually means rows were filtered/invalid during parsing`,
			);
		}
		if (runtimeDataStatus.eventCount !== parsedEventCount) {
			mismatches.push(
				`Live runtime event count (${runtimeDataStatus.eventCount}) differs from parsed event count (${parsedEventCount}); runtime source may still be on fallback`,
			);
		}
		if (
			freshDataStatus.success &&
			(runtimeDataStatus.eventCount !== freshDataStatus.count ||
				runtimeDataStatus.dataSource !== freshDataStatus.source)
		) {
			mismatches.push(
				`Cached runtime source (${runtimeDataStatus.dataSource}, ${runtimeDataStatus.eventCount} events) differs from fresh source (${freshDataStatus.source}, ${freshDataStatus.count} events)`,
			);
		}
		if (eventStoreMeta.rowCount !== eventStoreCounts.rowCount) {
			mismatches.push(
				`Postgres event tables disagree: meta rowCount (${eventStoreMeta.rowCount}) vs rows table count (${eventStoreCounts.rowCount})`,
			);
		}

		return NextResponse.json(
			{
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
					csvPublishableRows: csvPublishableRowCount,
					parsedEvents: parsedEventCount,
					liveRuntimeEvents: runtimeDataStatus.eventCount,
					freshSourceEvents: freshDataStatus.success
						? freshDataStatus.count
						: 0,
					liveEvents: runtimeDataStatus.eventCount,
					currentYearEvents: runtimeDataStatus.currentYearEventCount,
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
					cachedSource: runtimeDataStatus.dataSource,
					freshSource: freshDataStatus.source,
					freshSourceSuccess: freshDataStatus.success,
					freshSourceError: freshDataStatus.error ?? "",
				},
			},
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
