import { getFeaturedStatusEvents } from "@/features/events/events-service";
import { FeatureCountdown } from "@/features/events/featured/components/FeatureCountdown";

export async function FeatureEventStatusSection() {
	const featuredEvents = await getFeaturedStatusEvents();
	return <FeatureCountdown featuredEvents={featuredEvents} variant="editorial" />;
}
