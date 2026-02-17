import { getFeaturedEventsCached } from "@/features/events/events-service";
import { FeatureCountdown } from "@/features/events/featured/components/FeatureCountdown";

export async function FeatureEventStatusSection() {
	const featuredEvents = await getFeaturedEventsCached();
	return <FeatureCountdown featuredEvents={featuredEvents} variant="editorial" />;
}

