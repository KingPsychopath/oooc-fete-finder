import type { Event } from "@/types/events";

export type FeaturedEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	onScrollToAllEvents: () => void;
	maxFeaturedEvents?: number;
};

export type FeaturedEventSelectionResult = {
	featuredEvents: Event[];
	totalEventsCount: number;
	hasMoreEvents: boolean;
};

export type FeatureTimeRemaining = {
	timeRemaining: string;
	isExpired: boolean;
}; 