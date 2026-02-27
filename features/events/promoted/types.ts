export type PromotedScheduleStatus = "scheduled" | "cancelled" | "completed";

export interface PromotedScheduleEntry {
	id: string;
	eventKey: string;
	requestedStartAt: string;
	effectiveStartAt: string;
	effectiveEndAt: string;
	durationHours: number;
	status: PromotedScheduleStatus;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

export type PromotedState =
	| "active"
	| "upcoming"
	| "recent-ended"
	| "completed"
	| "cancelled";

export interface PromotedQueueItem extends PromotedScheduleEntry {
	eventName: string;
	state: PromotedState;
}

export interface PromotedProjection {
	active: PromotedScheduleEntry[];
	upcoming: PromotedScheduleEntry[];
	recentEnded: PromotedScheduleEntry[];
}

export interface PromotedSlotConfig {
	defaultDurationHours: number;
	timezone: string;
	recentEndedWindowHours: number;
}
