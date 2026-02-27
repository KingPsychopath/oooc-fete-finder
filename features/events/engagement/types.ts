export const EVENT_ENGAGEMENT_ACTIONS = [
	"click",
	"outbound_click",
	"calendar_sync",
] as const;

export type EventEngagementAction = (typeof EVENT_ENGAGEMENT_ACTIONS)[number];

export interface EventEngagementRecordInput {
	eventKey: string;
	actionType: EventEngagementAction;
	sessionId?: string | null;
	source?: string | null;
	path?: string | null;
	isAuthenticated?: boolean | null;
	recordedAt?: string;
}

export interface EventEngagementSummary {
	eventKey: string;
	clickCount: number;
	dedupedViewCount: number;
	outboundClickCount: number;
	calendarSyncCount: number;
	uniqueSessionCount: number;
	uniqueViewSessionCount: number;
	uniqueOutboundSessionCount: number;
	uniqueCalendarSessionCount: number;
}
