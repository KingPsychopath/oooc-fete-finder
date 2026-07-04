import "server-only";

import { isOffseasonPlaceholderEnabled } from "@/lib/offseason-placeholder";

export async function runNodeInstrumentation(): Promise<void> {
	if (isOffseasonPlaceholderEnabled()) {
		console.log("[fete-finder] Off-season placeholder active");
		return;
	}

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
}
