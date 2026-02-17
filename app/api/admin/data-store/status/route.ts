import { NextRequest, NextResponse } from "next/server";
import { validateAdminKeyForApiRoute } from "@/lib/admin/admin-validation";
import { CacheManager } from "@/lib/cache-management/cache-manager";
import { DataManager } from "@/lib/data-management/data-manager";
import { LocalEventStore } from "@/lib/data-management/local-event-store";

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
		return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	}

	try {
		const [storeStatus, dataConfig, cacheStatus, cacheMetrics] = await Promise.all([
			LocalEventStore.getStatus(),
			DataManager.getDataConfigStatus(),
			CacheManager.getCacheStatus(),
			Promise.resolve(CacheManager.getCacheMetrics()),
		]);

		return NextResponse.json({
			success: true,
			timestamp: new Date().toISOString(),
			modeModel: {
				remote:
					"Primary source is managed store (Postgres preferred); remote CSV/Google is fallback only.",
				local:
					"Primary source is local fallback file (data/events.csv) with no remote reads.",
				test: "Primary source is hardcoded demo dataset only.",
			},
			store: storeStatus,
			config: dataConfig,
			cache: cacheStatus,
			metrics: cacheMetrics,
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
