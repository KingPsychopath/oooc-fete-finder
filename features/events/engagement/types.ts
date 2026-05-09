export const EVENT_ENGAGEMENT_ACTIONS = [
	"click",
	"outbound_click",
	"calendar_sync",
	"map_open",
	"map_preference_change",
] as const;

export type EventEngagementAction = (typeof EVENT_ENGAGEMENT_ACTIONS)[number];

export interface EventEngagementRecordInput {
	eventKey: string;
	actionType: EventEngagementAction;
	userId?: string | null;
	sessionId?: string | null;
	source?: string | null;
	path?: string | null;
	isAuthenticated?: boolean | null;
	deviceClass?: string | null;
	platform?: string | null;
	browserFamily?: string | null;
	timezone?: string | null;
	locale?: string | null;
	recordedAt?: string;
}

export interface EventEngagementSummary {
	eventKey: string;
	clickCount: number;
	dedupedViewCount: number;
	outboundClickCount: number;
	calendarSyncCount: number;
	mapOpenCount: number;
	mapPreferenceChangeCount: number;
	uniqueSessionCount: number;
	uniqueViewSessionCount: number;
	uniqueOutboundSessionCount: number;
	uniqueCalendarSessionCount: number;
	uniqueMapSessionCount: number;
}
