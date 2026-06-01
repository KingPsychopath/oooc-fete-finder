import { getFeaturedStatusEvents } from "@/features/events/events-service";
import { FeatureCountdown } from "@/features/events/featured/components/FeatureCountdown";
import { unstable_cache as cache } from "next/cache";

const getFeaturedStatusEventsCached = cache(
	async () => getFeaturedStatusEvents(),
	["feature-event-status-events"],
	{ revalidate: false, tags: ["events", "events-data", "featured-events"] },
);

export async function FeatureEventStatusSection() {
	const featuredEvents = await getFeaturedStatusEventsCached();
	return (
		<FeatureCountdown
			featuredEvents={featuredEvents}
			variant="editorial"
			initialNowIso={new Date().toISOString()}
		/>
	);
}
