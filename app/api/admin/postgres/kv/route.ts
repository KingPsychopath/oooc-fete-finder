import { NextRequest, NextResponse } from "next/server";
import { validateAdminKeyForApiRoute } from "@/lib/admin/admin-validation";
import {
	getAppKVStoreRepository,
	getAppKVStoreTableName,
} from "@/lib/platform/postgres/app-kv-store-repository";

const parseLimit = (value: string | null, fallback: number, max: number): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	if (Number.isNaN(parsed)) return fallback;
	return Math.max(1, Math.min(parsed, max));
};

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	const repository = getAppKVStoreRepository();
	if (!repository) {
		return NextResponse.json(
			{
				success: false,
				error: "Postgres is not configured (DATABASE_URL missing or invalid)",
			},
			{ status: 503 },
		);
	}

	try {
		const { searchParams } = new URL(request.url);
		const key = searchParams.get("key")?.trim() ?? "";
		const prefix = searchParams.get("prefix")?.trim() ?? "";
		const limit = parseLimit(searchParams.get("limit"), 100, 500);
		const includeValues = searchParams.get("includeValues") === "1";

		if (key) {
			const record = await repository.getRecord(key);
			if (!record) {
				return NextResponse.json({
					success: true,
					table: getAppKVStoreTableName(),
					key,
					found: false,
				});
			}

			return NextResponse.json({
				success: true,
				table: getAppKVStoreTableName(),
				key,
				found: true,
				record:
					includeValues ?
						record
					:	{
							key: record.key,
							updatedAt: record.updatedAt,
						},
			});
		}

		const [records, totalKeyCount, eventsStoreStats] = await Promise.all([
			repository.listRecords({ prefix, limit }),
			repository.countKeys(prefix),
			repository.getEventsStoreStats(),
		]);

		return NextResponse.json({
			success: true,
			table: getAppKVStoreTableName(),
			query: {
				prefix,
				limit,
				includeValues,
			},
			totalKeyCount,
			returnedCount: records.length,
			eventsStore: eventsStoreStats,
			records:
				includeValues ?
					records
				:	records.map((record) => ({
						key: record.key,
						updatedAt: record.updatedAt,
					})),
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
