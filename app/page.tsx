import Header from "@/components/Header";
import { EventsClient } from "@/features/events/components/events-client";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";
import { CacheManager } from "@/lib/cache/cache-manager";
import { env } from "@/lib/config/env";

// Use ISR with a reasonable revalidation time (e.g., 1 hour)
// This can be overridden with on-demand revalidation
export const revalidate = 3600; // 1 hour in seconds

// Make the page component async to allow server-side data fetching
export default async function Home() {
	// Fetch events using centralized cache manager
	const [result, bannerSettings] = await Promise.all([
		CacheManager.getEvents(),
		getPublicSlidingBannerSettingsCached(),
	]);
	const isRemoteMode = env.DATA_MODE === "remote";
	const isLocalFallback = isRemoteMode && result.source === "local";

	if (result.error) {
		console.error("Error loading events:", result.error);
		// You might want to show an error UI here
	}

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={bannerSettings} />
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				{isLocalFallback && (
					<div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
						<strong>Note:</strong> Live Postgres data is currently unavailable.
						The app is serving local CSV fallback data until the store is
						restored.
					</div>
				)}

				{/* Editorial intro — design system: section label + display heading + divider */}
				<section className="mb-8" aria-label="Introduction">
					<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
						Paris · Fête de la Musique
					</p>
					<h2
						className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Discover events across the city
					</h2>
					<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
						Explore live music and cultural events by arrondissement. Use the
						map and filters to find what’s on.
					</p>
					<div className="mt-6 border-t border-border" role="presentation" />
				</section>

				<EventsClient initialEvents={result.data} />
			</main>
		</div>
	);
}
