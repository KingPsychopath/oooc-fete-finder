import type { AdminActivityEvent } from "@/features/admin/activity/types";
import type { CollectedUserProfile, UserRecord } from "@/features/auth/types";
import type { EventSubmissionRecord } from "@/features/events/submissions/types";
import type { UserPlan } from "@/features/plans/types";
import type {
	TicketExchangeAdminListing,
	TicketExchangeAdminReport,
} from "@/features/ticket-exchange/types";

export const USER_RESTRICTION_SCOPES = [
	"all_user_actions",
	"auth.login",
	"ticket_exchange.post",
	"ticket_exchange.contact_unlock",
	"ticket_exchange.report",
	"event_submission.create",
	"plans.sync",
	"saved_events.sync",
	"user_preferences.write",
	"app_settings.sync",
] as const;

export type UserRestrictionScope = (typeof USER_RESTRICTION_SCOPES)[number];

export const USER_NOTICE_TARGET_TYPES = [
	"user",
	"email",
	"segment",
	"global",
	"authenticated_users",
] as const;

export type UserNoticeTargetType = (typeof USER_NOTICE_TARGET_TYPES)[number];

export const USER_NOTICE_SEVERITIES = [
	"info",
	"success",
	"warning",
	"action_required",
	"critical",
] as const;

export type UserNoticeSeverity = (typeof USER_NOTICE_SEVERITIES)[number];

export const USER_ADMIN_NOTE_CATEGORIES = [
	"general",
	"policy",
	"support",
	"fraud",
	"privacy",
] as const;

export type UserAdminNoteCategory = (typeof USER_ADMIN_NOTE_CATEGORIES)[number];

export type ManagedUserStatus =
	| "active"
	| "unsubscribed"
	| "deleted"
	| "blocked";

export const ADMIN_USERS_SORT_KEYS = [
	"last_seen",
	"first_seen",
	"active_restrictions",
	"open_notices",
	"ticket_listings",
	"active_ticket_listings",
	"ticket_reports",
	"event_submissions",
	"plans",
	"saved_events",
] as const;

export type AdminUsersSortKey = (typeof ADMIN_USERS_SORT_KEYS)[number];

export type AdminUsersSortDirection = "asc" | "desc";

export const ADMIN_USERS_ACTIVITY_FILTERS = [
	"all",
	"needs_attention",
	"has_restrictions",
	"has_notices",
	"has_ticket_listings",
	"has_active_ticket_listings",
	"has_ticket_reports",
	"has_submissions",
	"has_plans",
	"has_saved_events",
] as const;

export type AdminUsersActivityFilter =
	(typeof ADMIN_USERS_ACTIVITY_FILTERS)[number];

export interface AdminUsersQuery {
	query?: string;
	status?: ManagedUserStatus | "all";
	activity?: AdminUsersActivityFilter;
	sortKey?: AdminUsersSortKey;
	sortDirection?: AdminUsersSortDirection;
	page?: number;
	pageSize?: number;
}

export interface UserRestriction {
	id: string;
	userId: string | null;
	email: string | null;
	scope: UserRestrictionScope;
	reason: string;
	internalNote: string;
	startsAt: string;
	expiresAt: string | null;
	createdBy: string;
	createdAt: string;
	revokedAt: string | null;
	revokedBy: string | null;
	isActive: boolean;
}

export interface UserNotice {
	id: string;
	targetType: UserNoticeTargetType;
	targetUserId: string | null;
	targetEmail: string | null;
	segmentKey: string | null;
	title: string;
	body: string;
	severity: UserNoticeSeverity;
	ctaLabel: string | null;
	ctaHref: string | null;
	requiresAck: boolean;
	dismissible: boolean;
	startsAt: string;
	expiresAt: string | null;
	createdBy: string;
	createdAt: string;
	revokedAt: string | null;
	revokedBy: string | null;
	internalNote: string;
	isActive: boolean;
	deliveredCount?: number;
	readCount?: number;
	dismissedCount?: number;
	acknowledgedCount?: number;
	recipientReadAt?: string | null;
	recipientDismissedAt?: string | null;
	recipientAcknowledgedAt?: string | null;
}

export interface UserNoticeReceipt {
	id: string;
	noticeId: string;
	userId: string | null;
	email: string | null;
	deliveredAt: string;
	readAt: string | null;
	dismissedAt: string | null;
	acknowledgedAt: string | null;
}

export interface PublicUserNotice {
	id: string;
	title: string;
	body: string;
	severity: UserNoticeSeverity;
	ctaLabel: string | null;
	ctaHref: string | null;
	requiresAck: boolean;
	dismissible: boolean;
	expiresAt: string | null;
	receipt: {
		readAt: string | null;
		dismissedAt: string | null;
		acknowledgedAt: string | null;
	} | null;
}

export interface UserAdminNote {
	id: string;
	userId: string | null;
	email: string | null;
	category: UserAdminNoteCategory;
	note: string;
	createdBy: string;
	createdAt: string;
}

export interface AdminUserSummary {
	userId: string;
	email: string;
	firstName: string;
	lastName: string;
	status: ManagedUserStatus;
	source: string;
	firstSeenAt: string;
	lastSeenAt: string;
	lastAuthenticatedAt: string | null;
	marketingConsent: boolean;
	eventUpdateConsent: boolean;
	activeRestrictionCount: number;
	openNoticeCount: number;
	adminNoteCount: number;
	ticketListingCount: number;
	activeTicketListingCount: number;
	openTicketReportCount: number;
	ticketReportCount: number;
	ticketReportsMadeCount: number;
	ticketReportsAgainstListingCount: number;
	eventSubmissionCount: number;
	planCount: number;
	savedEventCount: number;
}

export interface UserPolicyDecision {
	allowed: boolean;
	restriction: UserRestriction | null;
	reason: string | null;
}

export interface AdminEventReference {
	eventKey: string;
	name: string;
	slug: string;
	date: string;
	time: string | null;
	location: string | null;
	areaLabel: string;
	publicPath: string;
	ticketExchangePath: string;
	found: boolean;
}

export interface AdminSavedEventDetail {
	eventKey: string;
	event: AdminEventReference;
}

export interface AdminPlanStopDetail {
	id: string;
	eventKey: string;
	stopOrder: number;
	locked: boolean;
	arrivalTime: string | null;
	departureTime: string | null;
	travelMinutesFromPrevious: number | null;
	event: AdminEventReference;
}

export interface AdminPlanDetail extends UserPlan {
	resolvedStops: AdminPlanStopDetail[];
	publicSharePath: string | null;
}

export interface AdminUserDetail {
	user: AdminUserSummary | null;
	collectedProfile: CollectedUserProfile | null;
	collectedRecord: UserRecord | null;
	restrictions: UserRestriction[];
	notices: UserNotice[];
	noticeReceipts: UserNoticeReceipt[];
	adminNotes: UserAdminNote[];
	ticketListings: TicketExchangeAdminListing[];
	ticketReports: TicketExchangeAdminReport[];
	eventSubmissions: EventSubmissionRecord[];
	plans: AdminPlanDetail[];
	savedEvents: AdminSavedEventDetail[];
	savedEventKeys: string[];
	activityEvents: AdminActivityEvent[];
}

export interface AdminUsersDashboard {
	supported: boolean;
	users: AdminUserSummary[];
	activeRestrictions: UserRestriction[];
	globalNotices: UserNotice[];
	recentNotes: UserAdminNote[];
	totalUsers: number;
	attentionUserCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
	query: AdminUsersQuery;
	error?: string;
}
