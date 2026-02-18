import type { Event } from "@/features/events/types";

export type FeaturedEventsProps = {
	events: Event[];
	onEventClick: (event: Event) => void;
	onScrollToAllEvents: () => void;
	maxFeaturedEvents?: number;
};

export type SafeFeaturedEventsProps = {
	events: NonNullable<Event>[];
	onEventClick: (event: NonNullable<Event>) => void;
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

export type FeaturedScheduleStatus =
	| "scheduled"
	| "cancelled"
	| "completed";

export interface FeatureSlotConfig {
	maxConcurrent: number;
	defaultDurationHours: number;
	timezone: string;
	recentEndedWindowHours: number;
}

export interface FeaturedScheduleEntry {
	id: string;
	eventKey: string;
	requestedStartAt: string;
	effectiveStartAt: string;
	effectiveEndAt: string;
	durationHours: number;
	status: FeaturedScheduleStatus;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export type FeaturedQueueState =
	| "active"
	| "upcoming"
	| "recent-ended"
	| "completed"
	| "cancelled";

export interface FeaturedQueueItem extends FeaturedScheduleEntry {
	eventName: string;
	state: FeaturedQueueState;
	queuePosition: number | null;
}

export interface FeaturedProjection {
	active: FeaturedScheduleEntry[];
	upcoming: FeaturedScheduleEntry[];
	recentEnded: FeaturedScheduleEntry[];
	slotConfig: FeatureSlotConfig;
}
