import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { DataManager } from "@/features/data-management/data-manager";
import { LocalEventStore } from "@/features/data-management/local-event-store";
import {
	getRuntimeDataStatusFromSource,
	getRuntimeMetrics,
} from "@/features/data-management/runtime-service";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

const getAdminCredential = (request: NextRequest): string | null => {
	const direct = request.headers.get("x-admin-key");
	if (direct) return direct;

	const auth = request.headers.get("authorization");
	if (!auth) return null;
	const [scheme, token] = auth.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;
	return token;
};

export async function GET(request: NextRequest) {
	const credential = getAdminCredential(request);
	if (!(await validateAdminKeyForApiRoute(request, credential))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const [storeStatus, dataConfig, runtimeDataStatus, runtimeMetrics] =
			await Promise.all([
				LocalEventStore.getStatus(),
				DataManager.getDataConfigStatus(),
				getRuntimeDataStatusFromSource(),
				Promise.resolve(getRuntimeMetrics()),
			]);

		return NextResponse.json(
			{
				success: true,
				timestamp: new Date().toISOString(),
				modeModel: {
					remote:
						"Primary source is managed Postgres store; local CSV file is stale-safe fallback if store is unavailable.",
					local:
						"Primary source is local fallback file (data/events.csv) with no remote reads.",
					test: "Primary source is hardcoded demo dataset only.",
				},
				store: storeStatus,
				config: dataConfig,
				runtime: runtimeDataStatus,
				metrics: runtimeMetrics,
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
