import { unstable_noStore as noStore } from "next/cache";
import { getFeaturedStatusEvents } from "@/features/events/events-service";
import { FeatureCountdown } from "@/features/events/featured/components/FeatureCountdown";

export async function FeatureEventStatusSection() {
	noStore();
	const featuredEvents = await getFeaturedStatusEvents();
	return (
		<FeatureCountdown
			featuredEvents={featuredEvents}
			variant="editorial"
			initialNowIso={new Date().toISOString()}
		/>
	);
}
