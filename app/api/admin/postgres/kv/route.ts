import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	getAppKVStoreRepository,
	getAppKVStoreTableName,
} from "@/lib/platform/postgres/app-kv-store-repository";
import { getEventSheetStoreRepository } from "@/lib/platform/postgres/event-sheet-store-repository";
import { NextRequest, NextResponse } from "next/server";

const parseLimit = (
	value: string | null,
	fallback: number,
	max: number,
): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	if (Number.isNaN(parsed)) return fallback;
	return Math.max(1, Math.min(parsed, max));
};

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	const repository = getAppKVStoreRepository();
	if (!repository) {
		return NextResponse.json(
			{
				success: false,
				error: "Postgres is not configured (DATABASE_URL missing or invalid)",
			},
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const { searchParams } = new URL(request.url);
		const key = searchParams.get("key")?.trim() ?? "";
		const prefix = searchParams.get("prefix")?.trim() ?? "";
		const limit = parseLimit(searchParams.get("limit"), 100, 500);
		const includeValues = searchParams.get("includeValues") === "1";
		const eventRepository = getEventSheetStoreRepository();

		if (key) {
			const record = await repository.getRecord(key);
			if (!record) {
				return NextResponse.json(
					{
						success: true,
						table: getAppKVStoreTableName(),
						key,
						found: false,
					},
					{ headers: NO_STORE_HEADERS },
				);
			}

			return NextResponse.json(
				{
					success: true,
					table: getAppKVStoreTableName(),
					key,
					found: true,
					record: includeValues
						? record
						: {
								key: record.key,
								updatedAt: record.updatedAt,
							},
				},
				{ headers: NO_STORE_HEADERS },
			);
		}

		const [
			records,
			totalKeyCount,
			eventsStoreStats,
			eventStoreCounts,
			eventStoreMeta,
		] = await Promise.all([
			repository.listRecords({ prefix, limit }),
			repository.countKeys(prefix),
			repository.getEventsStoreStats(),
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

		return NextResponse.json(
			{
				success: true,
				table: getAppKVStoreTableName(),
				query: {
					prefix,
					limit,
					includeValues,
				},
				totalKeyCount,
				returnedCount: records.length,
				eventsStoreKv: eventsStoreStats,
				eventStoreTables: {
					rowCount: eventStoreCounts.rowCount,
					columnCount: eventStoreCounts.columnCount,
					meta: eventStoreMeta,
				},
				records: includeValues
					? records
					: records.map((record) => ({
							key: record.key,
							updatedAt: record.updatedAt,
						})),
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
