import { EventsClient } from "@/components/events-client";
import Header from "@/components/Header";
import { CacheManager } from "@/lib/cache-management/cache-manager";
import { env } from "@/lib/config/env";

// Use ISR with a reasonable revalidation time (e.g., 1 hour)
// This can be overridden with on-demand revalidation
export const revalidate = 3600; // 1 hour in seconds

// Make the page component async to allow server-side data fetching
export default async function Home() {
	// Fetch events using centralized cache manager
	const result = await CacheManager.getEvents();
	const isRemoteMode = env.DATA_MODE === "remote";
	const isLocalFallback = isRemoteMode && result.source === "local";

	if (result.error) {
		console.error("Error loading events:", result.error);
		// You might want to show an error UI here
	}

	return (
		<div className="ooo-site-shell">
			<Header />
			<main className="container mx-auto px-4 py-8">
				{isLocalFallback && (
					<div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						Live Postgres data is currently unavailable. The app is serving local
						CSV fallback data until the store is restored.
					</div>
				)}
				<EventsClient initialEvents={result.data} />
			</main>
		</div>
	);
}
