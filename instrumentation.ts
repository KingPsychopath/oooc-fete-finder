/**
 * Runs once when the Next.js server starts.
 * One-line banner so you know immediately: app name, data config, geocoding status.
 */
export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;

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

	// Warm events cache once at process start to reduce first-page latency.
	const { CacheManager } = await import("@/lib/cache/cache-manager");
	await CacheManager.prewarmInBackground();
}
