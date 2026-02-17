import "server-only";

import { CacheManager } from "@/lib/cache/cache-manager";
import { log } from "@/lib/platform/logger";

export async function runNodeInstrumentation(): Promise<void> {
	const dataMode = process.env.DATA_MODE ?? "remote";
	const hasDb = Boolean(process.env.DATABASE_URL);
	const hasGeocoding = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());

	const parts = [
		"[fete-finder] Ready",
		`data=${dataMode}`,
		`db=${hasDb ? "yes" : "no"}`,
		`geocoding=${hasGeocoding ? "api" : "arrondissement-fallback"}`,
	];
	console.log(parts.join(" | "));

	try {
		await CacheManager.prewarmInBackground();
	} catch (error) {
		log.warn("instrumentation", "Cache prewarm failed during startup", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
