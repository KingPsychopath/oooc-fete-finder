import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { DataManager } from "@/features/data-management/data-manager";
import { LocalEventStore } from "@/features/data-management/local-event-store";
import {
	getRuntimeDataStatusFromSource,
	getRuntimeMetrics,
} from "@/features/data-management/runtime-service";
import { getAdminCredentialFromRequest } from "@/lib/http/admin-request";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const credential = getAdminCredentialFromRequest(request);
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
