// Main component
export { FeaturedEvents } from "./FeaturedEvents";

// Child components
export { FeaturedEventCard } from "./components/FeaturedEventCard";
export { FeaturedEventsHeader } from "./components/FeaturedEventsHeader";
export { FeatureCountdown } from "./components/FeatureCountdown";

// Hooks
export { useFeaturedEvents } from "./hooks/use-featured-events";
export { useFeatureTimeRemaining } from "./hooks/use-feature-time-remaining";

// Types
export type {
	FeaturedEventsProps,
	FeaturedEventSelectionResult,
	FeatureTimeRemaining,
} from "./types";

// Constants
export { FEATURED_EVENTS_CONFIG } from "./constants";
export type { FeaturedEventsConfig } from "./constants"; 