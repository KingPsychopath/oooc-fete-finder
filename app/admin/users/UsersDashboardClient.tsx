"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	deleteCollectedEmails,
	exportCollectedEmailsCsv,
	getCollectedEmails,
	getCollectedUserProfile,
	importCollectedEmails,
} from "@/features/auth/actions";
import type {
	CollectedEmailsResponse,
	CollectedUserProfile,
} from "@/features/auth/types";
import {
	createUserNoticeAsAdmin,
	createUserRestrictionAsAdmin,
	getAdminUsersDashboard,
	revokeUserNoticeAsAdmin,
} from "@/features/users/admin-actions";
import {
	ADMIN_USER_ATTENTION_DETAIL,
	ADMIN_USER_ATTENTION_SUMMARY,
	getAdminUserAttentionReasons,
} from "@/features/users/attention";
import {
	getDefaultNoticeExpiresAtInputValue,
	getNoticeCtaHrefError,
	getNoticeLifecycleError,
	normalizeNoticeCtaHref,
} from "@/features/users/notice-form";
import type {
	AdminUserSummary,
	AdminUsersActivityFilter,
	AdminUsersAudienceSignalFilter,
	AdminUsersDashboard,
	AdminUsersSortDirection,
	AdminUsersSortKey,
	ManagedUserStatus,
	UserNoticeSeverity,
	UserNoticeTargetType,
	UserRestrictionScope,
} from "@/features/users/types";
import { cn } from "@/lib/utils";
import {
	AlertTriangle,
	Ban,
	Bell,
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Copy,
	Download,
	ExternalLink,
	Eye,
	FileUp,
	Filter,
	Fingerprint,
	RefreshCw,
	Search,
	Send,
	ShieldAlert,
	Trash2,
	Upload,
	UserRound,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { buildAdminUserHref } from "../components/audience-profile-utils";
import { withAdminBasePath } from "../config";
import type {
	EmailRecord,
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
} from "../types";

type UsersDashboardClientProps = {
	initialDashboard: AdminUsersDashboard;
	initialEmailsResult?: CollectedEmailsResponse;
};

const formatDateTime = (value: string | null): string => {
	if (!value) return "Not yet";
	try {
		return new Intl.DateTimeFormat("en-GB", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
};

const statusVariant = (status: ManagedUserStatus) =>
	status === "blocked" || status === "deleted"
		? ("destructive" as const)
		: status === "active"
			? ("default" as const)
			: ("outline" as const);

const statusLabel = (status: ManagedUserStatus): string =>
	status === "active"
		? "Active"
		: status === "blocked"
			? "Blocked"
			: status === "deleted"
				? "Deleted"
				: "Unsubscribed";

const noticeSeverityClass = (severity: UserNoticeSeverity): string => {
	switch (severity) {
		case "critical":
			return "ooo-notice-card--critical";
		case "action_required":
			return "ooo-notice-card--action-required";
		case "warning":
			return "ooo-notice-card--warning";
		case "success":
			return "ooo-notice-card--success";
		case "info":
		default:
			return "ooo-notice-card--info";
	}
};

const noticeSeverityLabel = (severity: UserNoticeSeverity): string => {
	switch (severity) {
		case "critical":
			return "Critical notice";
		case "action_required":
			return "Action required";
		case "warning":
			return "Heads up";
		case "success":
			return "Good news";
		case "info":
		default:
			return "Site notice";
	}
};

const noticeTargetLabel = (
	targetType: UserNoticeTargetType,
	segmentKey?: string | null,
): string => {
	switch (targetType) {
		case "global":
			return "Everyone";
		case "authenticated_users":
			return "Signed-in users";
		case "segment":
			return segmentKey ? `Segment: ${segmentKey}` : "Segment";
		case "user":
			return "Direct user";
		case "email":
		default:
			return "Email target";
	}
};

const noticeStatus = (notice: {
	startsAt: string;
	expiresAt: string | null;
	revokedAt: string | null;
	isActive: boolean;
}): { label: string; variant: "default" | "outline" | "destructive" } => {
	const now = Date.now();
	const startsAt = new Date(notice.startsAt).getTime();
	const expiresAt = notice.expiresAt
		? new Date(notice.expiresAt).getTime()
		: null;
	if (notice.revokedAt) return { label: "Revoked", variant: "outline" };
	if (Number.isFinite(startsAt) && startsAt > now) {
		return { label: "Scheduled", variant: "outline" };
	}
	if (expiresAt && Number.isFinite(expiresAt) && expiresAt <= now) {
		return { label: "Expired", variant: "outline" };
	}
	return notice.isActive
		? { label: "Live", variant: "default" }
		: { label: "Inactive", variant: "outline" };
};

const noticeLifecycleLabel = (
	status: ReturnType<typeof noticeStatus>,
): string => status.label.toLowerCase();

const canRevokeNoticeStatus = (
	status: ReturnType<typeof noticeStatus>,
): boolean => status.label === "Live" || status.label === "Scheduled";

const userDisplayName = (user: AdminUserSummary): string => {
	const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
	return name || user.email;
};

const collectedProfileDisplayName = (profile: CollectedUserProfile): string => {
	const name = [profile.user.firstName, profile.user.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	return name || profile.user.email;
};

const compactContextValue = (value: string | null | undefined): string =>
	value?.trim() || "Unknown";

const userSectionHref = (
	user: Pick<AdminUserSummary, "userId">,
	sectionId: "ticket-exchange" | "submissions-plans" | "identity",
): string =>
	withAdminBasePath(
		`/admin/users/${encodeURIComponent(user.userId)}#${sectionId}`,
	);

const userStatLinkClass =
	"underline-offset-2 transition-colors hover:text-foreground hover:underline";

const pluralCount = (
	count: number,
	singular: string,
	plural = `${singular}s`,
) => `${count} ${count === 1 ? singular : plural}`;

const UserStat = ({
	count,
	singular,
	plural,
	href,
}: {
	count: number;
	singular: string;
	plural?: string;
	href: string;
}) => {
	const label = pluralCount(count, singular, plural);
	return count > 0 ? (
		<Link href={href} className={userStatLinkClass}>
			{label}
		</Link>
	) : (
		<span>{label}</span>
	);
};

const TEST_EMAIL_HINTS = [
	"test",
	"example",
	"demo",
	"fake",
	"dummy",
	"localhost",
	"invalid",
];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const RETURNED_AFTER_ACTION_THRESHOLD_MS = 30 * 60 * 1000;

const isLikelyTestEmail = (email: string): boolean => {
	const normalized = email.toLowerCase();
	return TEST_EMAIL_HINTS.some((hint) => normalized.includes(hint));
};

const getParsedTime = (value?: string | null): number => {
	const parsed = Date.parse(value ?? "");
	return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const getFirstVerifiedAt = (user: EmailRecord): string | undefined =>
	user.firstVerifiedAt || user.firstSignInAt || user.timestamp;

const getLastVerifiedAt = (user: EmailRecord): string | undefined =>
	user.lastVerifiedAt || user.lastAuthenticatedAt || user.timestamp;

const hasUsefulAudienceContext = (user: EmailRecord): boolean =>
	Boolean(
		user.deviceClass ||
			user.platform ||
			user.browserFamily ||
			user.timezone ||
			user.locale,
	);

const hasReturnedWithoutNewActivity = (user: EmailRecord): boolean => {
	const lastSeen = getParsedTime(user.lastSeenAt ?? user.lastAuthenticatedAt);
	const lastSignal = getParsedTime(user.lastSignalAt);
	if (Number.isNaN(lastSeen) || Number.isNaN(lastSignal)) return false;
	return lastSeen - lastSignal >= RETURNED_AFTER_ACTION_THRESHOLD_MS;
};

const matchesAudienceSignal = (
	user: EmailRecord,
	signal: AdminUsersAudienceSignalFilter,
): boolean => {
	const linkedSignalCount = user.linkedSignalCount ?? 0;
	const sevenDaysAgo = Date.now() - SEVEN_DAYS_MS;
	switch (signal) {
		case "has-activity":
			return linkedSignalCount > 0;
		case "no-activity":
			return linkedSignalCount <= 0;
		case "recently-active":
			return getParsedTime(user.lastSignalAt) >= sevenDaysAgo;
		case "searches":
			return (user.searchSignalCount ?? 0) > 0;
		case "filters":
			return (user.filterSignalCount ?? 0) > 0;
		case "plan-actions":
			return (user.planActionSignalCount ?? 0) > 0;
		case "event-actions":
			return (user.eventActionSignalCount ?? 0) > 0;
		case "genre-prefs":
			return (user.genrePreferenceSignalCount ?? 0) > 0;
		case "returned-no-activity":
			return hasReturnedWithoutNewActivity(user);
		case "has-context":
			return hasUsefulAudienceContext(user);
		case "missing-context":
			return !hasUsefulAudienceContext(user);
		case "all":
		default:
			return true;
	}
};

const csvEscape = (value: string | number | boolean | null | undefined) =>
	`"${String(value ?? "").replace(/"/g, '""')}"`;

const exportAdminUsersCsv = (
	users: AdminUserSummary[],
	filenamePrefix: string,
) => {
	if (users.length === 0 || typeof document === "undefined") return;
	const header = [
		"User ID",
		"Email",
		"First Name",
		"Last Name",
		"Status",
		"Source",
		"First Seen",
		"Last Seen",
		"Marketing Consent",
		"Event Update Consent",
		"Restrictions",
		"Pending Notices",
		"Listings",
		"Submissions",
		"Routes",
		"Saved Events",
	];
	const rows = users.map((user) =>
		[
			user.userId,
			user.email,
			user.firstName,
			user.lastName,
			user.status,
			user.source,
			user.firstSeenAt,
			user.lastSeenAt,
			user.marketingConsent,
			user.eventUpdateConsent,
			user.activeRestrictionCount,
			user.openNoticeCount,
			user.ticketListingCount,
			user.eventSubmissionCount,
			user.planCount,
			user.savedEventCount,
		]
			.map(csvEscape)
			.join(","),
	);
	const blob = new Blob(
		[[header.map(csvEscape).join(","), ...rows].join("\n")],
		{
			type: "text/csv;charset=utf-8;",
		},
	);
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${filenamePrefix}-${new Date().toISOString().split("T")[0]}.csv`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
};

const STATUS_OPTIONS: Array<{
	value: ManagedUserStatus | "all";
	label: string;
}> = [
	{ value: "all", label: "All status" },
	{ value: "active", label: "Active" },
	{ value: "blocked", label: "Blocked" },
	{ value: "unsubscribed", label: "Unsubscribed" },
	{ value: "deleted", label: "Deleted" },
];

const SORT_DIRECTION_LABELS: Record<AdminUsersSortDirection, string> = {
	asc: "low/old first",
	desc: "high/new first",
};

const getOptionLabel = <T extends string>(
	options: Array<{ value: T; label: string }>,
	value: T,
): string => options.find((option) => option.value === value)?.label ?? value;

const getPageWindow = (page: number, totalPages: number): number[] => {
	const safeTotal = Math.max(totalPages, 1);
	const safePage = Math.min(Math.max(page, 1), safeTotal);
	const windowSize = Math.min(5, safeTotal);
	const start = Math.max(
		1,
		Math.min(safePage - Math.floor(windowSize / 2), safeTotal - windowSize + 1),
	);
	return Array.from({ length: windowSize }, (_, index) => start + index);
};

const TARGET_OPTIONS: Array<{ value: UserNoticeTargetType; label: string }> = [
	{ value: "global", label: "Everyone" },
	{ value: "authenticated_users", label: "Signed-in users" },
	{ value: "segment", label: "Segment" },
];

const SEGMENT_OPTIONS = [
	{ value: "all_known_users", label: "All known users" },
	{ value: "ticket_exchange_users", label: "Ticket Exchange users" },
	{ value: "event_submitters", label: "Event submitters" },
	{ value: "route_planners", label: "Route planners" },
	{ value: "saved_event_users", label: "Saved event users" },
];

const SEVERITY_OPTIONS: Array<{ value: UserNoticeSeverity; label: string }> = [
	{ value: "info", label: "Info" },
	{ value: "success", label: "Success" },
	{ value: "warning", label: "Warning" },
	{ value: "action_required", label: "Action required" },
	{ value: "critical", label: "Critical" },
];

const ACTIVITY_OPTIONS: Array<{
	value: AdminUsersActivityFilter;
	label: string;
}> = [
	{ value: "all", label: "All activity" },
	{ value: "needs_attention", label: "Needs attention" },
	{ value: "has_restrictions", label: "Has restrictions" },
	{ value: "has_notices", label: "Has pending notices" },
	{ value: "has_ticket_listings", label: "Has listings" },
	{ value: "has_active_ticket_listings", label: "Has live listings" },
	{ value: "has_ticket_reports", label: "Has report history" },
	{ value: "has_submissions", label: "Has submissions" },
	{ value: "has_plans", label: "Has routes" },
	{ value: "has_saved_events", label: "Has saved events" },
];

const AUDIENCE_SIGNAL_OPTIONS: Array<{
	value: AdminUsersAudienceSignalFilter;
	label: string;
}> = [
	{ value: "all", label: "All audience signals" },
	{ value: "has-activity", label: "Any linked activity" },
	{ value: "no-activity", label: "No linked activity" },
	{ value: "recently-active", label: "Active last 7d" },
	{ value: "searches", label: "Searchers" },
	{ value: "filters", label: "Filter users" },
	{ value: "plan-actions", label: "Plan users" },
	{ value: "event-actions", label: "Event action users" },
	{ value: "genre-prefs", label: "Genre preference users" },
	{ value: "returned-no-activity", label: "Returned after activity" },
	{ value: "has-context", label: "Context available" },
	{ value: "missing-context", label: "Context missing" },
];

const SORT_OPTIONS: Array<{ value: AdminUsersSortKey; label: string }> = [
	{ value: "last_seen", label: "Last seen" },
	{ value: "first_seen", label: "First seen" },
	{ value: "active_restrictions", label: "Restrictions" },
	{ value: "open_notices", label: "Pending notices" },
	{ value: "ticket_listings", label: "Listings" },
	{ value: "active_ticket_listings", label: "Live listings" },
	{ value: "ticket_reports", label: "Report activity" },
	{ value: "event_submissions", label: "Submissions" },
	{ value: "plans", label: "Routes" },
	{ value: "saved_events", label: "Saved events" },
];

const RESTRICTION_OPTIONS: Array<{
	value: UserRestrictionScope;
	label: string;
}> = [
	{ value: "all_user_actions", label: "All user actions" },
	{ value: "auth.login", label: "Login" },
	{ value: "ticket_exchange.post", label: "Ticket posting" },
	{ value: "ticket_exchange.contact_unlock", label: "Ticket contact unlocks" },
	{ value: "ticket_exchange.report", label: "Ticket reports" },
	{ value: "event_submission.create", label: "Event submissions" },
	{ value: "plans.sync", label: "Route syncing" },
	{ value: "saved_events.sync", label: "Saved events" },
	{ value: "user_preferences.write", label: "Preference writes" },
	{ value: "app_settings.sync", label: "App settings sync" },
];

const restrictionScopeLabel = (scope: UserRestrictionScope): string =>
	RESTRICTION_OPTIONS.find((option) => option.value === scope)?.label ?? scope;

export function UsersDashboardClient({
	initialDashboard,
	initialEmailsResult,
}: UsersDashboardClientProps) {
	const router = useRouter();
	const [emails, setEmails] = useState<EmailRecord[]>(
		initialEmailsResult?.success ? (initialEmailsResult.emails ?? []) : [],
	);
	const [emailStore, setEmailStore] =
		useState<UserCollectionStoreSummary | null>(
			initialEmailsResult?.success ? (initialEmailsResult.store ?? null) : null,
		);
	const [emailAnalytics, setEmailAnalytics] =
		useState<UserCollectionAnalytics | null>(
			initialEmailsResult?.success
				? (initialEmailsResult.analytics ?? null)
				: null,
		);
	const [isAudienceLoading, setIsAudienceLoading] = useState(false);
	const [hasAudienceLoaded, setHasAudienceLoaded] = useState(
		Boolean(initialEmailsResult?.success),
	);
	const [audienceSnapshotMessage, setAudienceSnapshotMessage] = useState("");
	const [dashboard, setDashboard] = useState(initialDashboard);
	const [query, setQuery] = useState(initialDashboard.query.query ?? "");
	const [status, setStatus] = useState<ManagedUserStatus | "all">(
		initialDashboard.query.status ?? "all",
	);
	const [activity, setActivity] = useState<AdminUsersActivityFilter>(
		initialDashboard.query.activity ?? "all",
	);
	const [audienceSignal, setAudienceSignal] =
		useState<AdminUsersAudienceSignalFilter>(
			initialDashboard.query.audienceSignal ?? "all",
		);
	const [sortKey, setSortKey] = useState<AdminUsersSortKey>(
		initialDashboard.query.sortKey ?? "last_seen",
	);
	const [sortDirection, setSortDirection] = useState<AdminUsersSortDirection>(
		initialDashboard.query.sortDirection ?? "desc",
	);
	const [pageSize, setPageSize] = useState(initialDashboard.pageSize);
	const [errorMessage, setErrorMessage] = useState(
		initialDashboard.error ?? "",
	);
	const [statusMessage, setStatusMessage] = useState("");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [isAudienceImportOpen, setIsAudienceImportOpen] = useState(false);
	const [audienceImportText, setAudienceImportText] = useState("");
	const [audienceImportStatus, setAudienceImportStatus] = useState("");
	const [isAudienceMutationPending, setIsAudienceMutationPending] =
		useState(false);
	const [quickProfileUser, setQuickProfileUser] =
		useState<AdminUserSummary | null>(null);
	const [quickProfile, setQuickProfile] = useState<CollectedUserProfile | null>(
		null,
	);
	const [quickProfileStatus, setQuickProfileStatus] = useState("");
	const [isQuickProfileLoading, setIsQuickProfileLoading] = useState(false);
	const [noticeComposerError, setNoticeComposerError] = useState("");
	const [quickActionError, setQuickActionError] = useState("");
	const [quickActionUser, setQuickActionUser] =
		useState<AdminUserSummary | null>(null);
	const [quickActionMode, setQuickActionMode] = useState<
		"notice" | "restriction" | null
	>(null);
	const [noticeTargetType, setNoticeTargetType] =
		useState<UserNoticeTargetType>("global");
	const [segmentKey, setSegmentKey] = useState("all_known_users");
	const [noticeSeverity, setNoticeSeverity] =
		useState<UserNoticeSeverity>("info");
	const [noticeTitle, setNoticeTitle] = useState("");
	const [noticeBody, setNoticeBody] = useState("");
	const [noticeCtaLabel, setNoticeCtaLabel] = useState("");
	const [noticeCtaHref, setNoticeCtaHref] = useState("");
	const [noticeRequiresAck, setNoticeRequiresAck] = useState(false);
	const [noticeDismissible, setNoticeDismissible] = useState(true);
	const [noticeStartsAt, setNoticeStartsAt] = useState("");
	const [noticeExpiresAt, setNoticeExpiresAt] = useState("");
	const [quickRestrictionScope, setQuickRestrictionScope] =
		useState<UserRestrictionScope>("ticket_exchange.post");
	const [quickRestrictionReason, setQuickRestrictionReason] = useState("");
	const [quickRestrictionNote, setQuickRestrictionNote] = useState("");
	const [quickRestrictionExpiresAt, setQuickRestrictionExpiresAt] =
		useState("");
	const [isPending, startTransition] = useTransition();
	const audienceImportFileInputRef = useRef<HTMLInputElement | null>(null);
	const quickProfileRequestIdRef = useRef(0);

	const normalizeDateTimeForAction = (value: string): string | null => {
		if (!value) return null;
		const parsed = new Date(value);
		return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
	};

	useEffect(() => {
		setNoticeExpiresAt((current) =>
			current ? current : getDefaultNoticeExpiresAtInputValue(),
		);
	}, []);

	const loadEmails = useCallback(async () => {
		let timeoutId: number | null = null;
		setIsAudienceLoading(true);
		setAudienceSnapshotMessage("");
		if (typeof window !== "undefined") {
			timeoutId = window.setTimeout(() => {
				setIsAudienceLoading(false);
				setAudienceSnapshotMessage(
					"Audience export data is still loading. The user list and Quick Profile remain available.",
				);
			}, 8000);
		}
		try {
			const result = await getCollectedEmails();
			if (result.success) {
				setEmails(result.emails ?? []);
				setEmailStore(result.store ?? null);
				setEmailAnalytics(result.analytics ?? null);
				setHasAudienceLoaded(true);
				setAudienceSnapshotMessage("");
			} else {
				setHasAudienceLoaded(false);
				setAudienceSnapshotMessage(
					result.error ?? "Audience export data failed to load.",
				);
			}
		} catch (error) {
			setHasAudienceLoaded(false);
			setAudienceSnapshotMessage(
				error instanceof Error
					? error.message
					: "Audience export data failed to load.",
			);
		} finally {
			if (timeoutId) window.clearTimeout(timeoutId);
			setIsAudienceLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialEmailsResult?.success) {
			return;
		}
		void loadEmails();
	}, [initialEmailsResult?.success, loadEmails]);

	const exportAsCSV = useCallback(async () => {
		const result = await exportCollectedEmailsCsv();
		if (!result.success || !result.csv) return;
		const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download =
			result.filename ??
			`fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, []);

	const emailRecordsByEmail = useMemo(
		() =>
			new Map(emails.map((entry) => [entry.email.trim().toLowerCase(), entry])),
		[emails],
	);
	const selectedUserIdSet = useMemo(
		() => new Set(selectedUserIds),
		[selectedUserIds],
	);
	const selectedUsers = useMemo(
		() => dashboard.users.filter((user) => selectedUserIdSet.has(user.userId)),
		[dashboard.users, selectedUserIdSet],
	);
	const selectedAudienceRecords = useMemo(
		() =>
			selectedUsers
				.map((user) => emailRecordsByEmail.get(user.email.trim().toLowerCase()))
				.filter((entry): entry is EmailRecord => Boolean(entry)),
		[emailRecordsByEmail, selectedUsers],
	);
	const visibleSelectedCount = dashboard.users.filter((user) =>
		selectedUserIdSet.has(user.userId),
	).length;
	const allVisibleSelected =
		dashboard.users.length > 0 &&
		visibleSelectedCount === dashboard.users.length;
	const likelyTestCount = emails.filter((entry) =>
		isLikelyTestEmail(entry.email),
	).length;
	const newRegistrations = useMemo(() => {
		const cutoff24h = Date.now() - ONE_DAY_MS;
		const cutoff7d = Date.now() - SEVEN_DAYS_MS;
		let last24h = 0;
		let last7d = 0;
		for (const entry of emails) {
			const parsed = getParsedTime(
				getFirstVerifiedAt(entry) ?? getLastVerifiedAt(entry),
			);
			if (Number.isNaN(parsed)) continue;
			if (parsed >= cutoff24h) last24h++;
			if (parsed >= cutoff7d) last7d++;
		}
		return { last24h, last7d };
	}, [emails]);
	const audienceSegmentCounts = useMemo(
		() =>
			new Map(
				AUDIENCE_SIGNAL_OPTIONS.filter((option) => option.value !== "all").map(
					(option) => [
						option.value,
						emails.filter((entry) => matchesAudienceSignal(entry, option.value))
							.length,
					],
				),
			),
		[emails],
	);
	const audienceCount = (value: number | null | undefined): string =>
		isAudienceLoading
			? "Loading"
			: hasAudienceLoaded
				? String(value ?? 0)
				: "Pending";
	const audiencePairCount = (
		first: number | null | undefined,
		second: number | null | undefined,
	): string =>
		isAudienceLoading
			? "Loading"
			: hasAudienceLoaded
				? `${first ?? 0} / ${second ?? 0}`
				: "Pending";
	const audienceContextSummary = (): string => {
		if (isAudienceLoading) return "Loading";
		if (!hasAudienceLoaded) return "Pending";
		return `${emailAnalytics?.topDeviceClasses?.[0]?.label ?? "Unknown"} / ${
			emailAnalytics?.topPlatforms?.[0]?.label ?? "Unknown"
		}`;
	};
	const audienceContextDetail = (): string => {
		if (isAudienceLoading) return "behavior context";
		if (!hasAudienceLoaded) return "export data";
		return `${emailAnalytics?.topBrowserFamilies?.[0]?.label ?? "Unknown"} / ${
			emailAnalytics?.topTimezones?.[0]?.label ?? "Unknown"
		}`;
	};

	const toggleUserSelection = (userId: string) => {
		setSelectedUserIds((current) =>
			current.includes(userId)
				? current.filter((selectedUserId) => selectedUserId !== userId)
				: [...current, userId],
		);
	};

	const toggleVisibleSelection = () => {
		setSelectedUserIds((current) => {
			const visibleIds = dashboard.users.map((user) => user.userId);
			if (allVisibleSelected) {
				return current.filter((userId) => !visibleIds.includes(userId));
			}
			return Array.from(new Set([...current, ...visibleIds]));
		});
	};

	const copySelectedUserEmails = async () => {
		if (selectedUsers.length === 0) return;
		await copyValue(
			"Selected emails",
			selectedUsers.map((user) => user.email).join("\n"),
		);
	};

	const handleAudienceImport = async (
		rawInput: string,
		sourceLabel: string,
	) => {
		if (!rawInput.trim()) return;
		setIsAudienceMutationPending(true);
		setAudienceImportStatus(`Importing ${sourceLabel} records...`);
		const result = await importCollectedEmails(rawInput);
		if (result.success) {
			setAudienceImportStatus(
				`Added ${result.importedCount ?? 0}, updated ${
					result.updatedCount ?? 0
				}, skipped ${result.skippedCount ?? 0}.`,
			);
			setAudienceImportText("");
			await loadEmails();
		} else {
			setAudienceImportStatus(result.error ?? "Import failed.");
		}
		setIsAudienceMutationPending(false);
	};

	const handleAudienceCsvSelected = async (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		try {
			await handleAudienceImport(await file.text(), file.name);
		} catch (error) {
			setAudienceImportStatus(
				`Failed to read CSV: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	};

	const deleteSelectedAudienceRecords = async () => {
		if (selectedAudienceRecords.length === 0) return;
		const confirmed = window.confirm(
			`Remove ${selectedAudienceRecords.length} selected audience record(s) from the collected email store? This does not delete canonical user accounts.`,
		);
		if (!confirmed) return;
		setIsAudienceMutationPending(true);
		const result = await deleteCollectedEmails(
			selectedAudienceRecords.map((entry) => entry.email),
		);
		if (result.success) {
			setStatusMessage(
				`Removed ${result.deletedCount ?? 0} audience record(s).`,
			);
			setSelectedUserIds((current) =>
				current.filter((userId) => !selectedUserIdSet.has(userId)),
			);
			await loadEmails();
		} else {
			setErrorMessage(result.error ?? "Unable to delete audience records.");
		}
		setIsAudienceMutationPending(false);
	};

	const resetNoticeComposer = (severity: UserNoticeSeverity = "info") => {
		setNoticeSeverity(severity);
		setNoticeTitle("");
		setNoticeBody("");
		setNoticeCtaLabel("");
		setNoticeCtaHref("");
		setNoticeStartsAt("");
		setNoticeExpiresAt(getDefaultNoticeExpiresAtInputValue());
		setNoticeRequiresAck(false);
		setNoticeDismissible(true);
	};

	const setNoticeAcknowledgementRequired = (checked: boolean) => {
		setNoticeRequiresAck(checked);
		setNoticeDismissible(!checked);
	};

	const noticePayload = () => ({
		title: noticeTitle,
		body: noticeBody,
		severity: noticeSeverity,
		ctaLabel: noticeCtaLabel,
		ctaHref: normalizeNoticeCtaHref(noticeCtaHref),
		requiresAck: noticeRequiresAck,
		dismissible: noticeRequiresAck ? false : noticeDismissible,
		startsAt: normalizeDateTimeForAction(noticeStartsAt),
		expiresAt: normalizeDateTimeForAction(noticeExpiresAt),
	});

	const validateNoticeComposer = (): string => {
		if (!noticeTitle.trim() || !noticeBody.trim()) {
			return "Notice title and body are required.";
		}
		if (
			(Boolean(noticeCtaLabel.trim()) && !noticeCtaHref.trim()) ||
			(!noticeCtaLabel.trim() && Boolean(noticeCtaHref.trim()))
		) {
			return "CTA label and link must be provided together.";
		}
		const startsAt = normalizeDateTimeForAction(noticeStartsAt);
		const expiresAt = normalizeDateTimeForAction(noticeExpiresAt);
		return (
			getNoticeCtaHrefError(noticeCtaHref) ??
			getNoticeLifecycleError({
				requiresAck: noticeRequiresAck,
				dismissible: noticeRequiresAck ? false : noticeDismissible,
				startsAt,
				expiresAt,
			}) ??
			""
		);
	};

	const refresh = (options?: {
		nextQuery?: string;
		nextStatus?: ManagedUserStatus | "all";
		nextActivity?: AdminUsersActivityFilter;
		nextAudienceSignal?: AdminUsersAudienceSignalFilter;
		nextSortKey?: AdminUsersSortKey;
		nextSortDirection?: AdminUsersSortDirection;
		nextPage?: number;
		nextPageSize?: number;
	}) => {
		const nextQuery = options?.nextQuery ?? query;
		const nextStatus = options?.nextStatus ?? status;
		const nextActivity = options?.nextActivity ?? activity;
		const nextAudienceSignal = options?.nextAudienceSignal ?? audienceSignal;
		const nextSortKey = options?.nextSortKey ?? sortKey;
		const nextSortDirection = options?.nextSortDirection ?? sortDirection;
		const nextPage = options?.nextPage ?? dashboard.page;
		const nextPageSize = options?.nextPageSize ?? pageSize;
		const params = new URLSearchParams();
		if (nextQuery.trim()) params.set("q", nextQuery.trim());
		if (nextStatus !== "all") params.set("status", nextStatus);
		if (nextActivity !== "all") params.set("activity", nextActivity);
		if (nextAudienceSignal !== "all") {
			params.set("audienceSignal", nextAudienceSignal);
		}
		if (nextSortKey !== "last_seen") params.set("sort", nextSortKey);
		if (nextSortDirection !== "desc") params.set("dir", nextSortDirection);
		if (nextPage > 1) params.set("page", String(nextPage));
		if (nextPageSize !== 25) params.set("pageSize", String(nextPageSize));
		const nextHref = params.size
			? `/admin/users?${params.toString()}`
			: "/admin/users";
		router.replace(withAdminBasePath(nextHref), { scroll: false });
		startTransition(async () => {
			const result = await getAdminUsersDashboard({
				query: nextQuery,
				status: nextStatus,
				activity: nextActivity,
				audienceSignal: nextAudienceSignal,
				sortKey: nextSortKey,
				sortDirection: nextSortDirection,
				page: nextPage,
				pageSize: nextPageSize,
			});
			setDashboard(result);
			setSelectedUserIds([]);
			setErrorMessage(result.error ?? "");
			setStatusMessage(result.supported ? "Users refreshed." : "");
		});
	};

	const submitSearch = () => {
		refresh({ nextPage: 1 });
	};

	const copyValue = async (label: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setStatusMessage(`${label} copied.`);
		} catch {
			setErrorMessage(`Could not copy ${label.toLowerCase()}.`);
		}
	};

	const openQuickProfile = async (user: AdminUserSummary) => {
		const requestId = quickProfileRequestIdRef.current + 1;
		let timeoutId: number | null = null;
		quickProfileRequestIdRef.current = requestId;
		setQuickProfileUser(user);
		setQuickProfile(null);
		setQuickProfileStatus("");
		setIsQuickProfileLoading(true);
		if (typeof window !== "undefined") {
			timeoutId = window.setTimeout(() => {
				if (quickProfileRequestIdRef.current !== requestId) return;
				setIsQuickProfileLoading(false);
				setQuickProfileStatus(
					"Behavior profile is still loading. Open Full Detail for the canonical user page, or try Quick Profile again.",
				);
			}, 8000);
		}
		try {
			const result = await getCollectedUserProfile({
				userId: user.userId,
				email: user.email,
			});
			if (quickProfileRequestIdRef.current !== requestId) return;
			if (result.success && result.profile) {
				setQuickProfile(result.profile);
			} else {
				setQuickProfileStatus(result.error ?? "No behavior profile found.");
			}
		} catch (error) {
			if (quickProfileRequestIdRef.current !== requestId) return;
			setQuickProfileStatus(
				error instanceof Error ? error.message : "No behavior profile found.",
			);
		} finally {
			if (timeoutId) window.clearTimeout(timeoutId);
			if (quickProfileRequestIdRef.current === requestId) {
				setIsQuickProfileLoading(false);
			}
		}
	};

	const closeQuickProfile = () => {
		quickProfileRequestIdRef.current += 1;
		setQuickProfileUser(null);
		setQuickProfile(null);
		setQuickProfileStatus("");
		setIsQuickProfileLoading(false);
	};

	const openQuickAction = (
		user: AdminUserSummary,
		mode: "notice" | "restriction",
	) => {
		setErrorMessage("");
		setStatusMessage("");
		setQuickActionError("");
		if (mode === "notice") resetNoticeComposer("warning");
		setQuickActionUser(user);
		setQuickActionMode(mode);
	};

	const submitGlobalNotice = () => {
		const validationError = validateNoticeComposer();
		setErrorMessage("");
		setStatusMessage("");
		setNoticeComposerError(validationError);
		if (validationError) return;
		startTransition(async () => {
			const result = await createUserNoticeAsAdmin({
				targetType: noticeTargetType,
				segmentKey: noticeTargetType === "segment" ? segmentKey : null,
				...noticePayload(),
			});
			if (!result.success) {
				setNoticeComposerError(result.error ?? "Unable to create notice.");
				return;
			}
			setNoticeComposerError("");
			resetNoticeComposer();
			setStatusMessage("Notice created.");
			refresh();
		});
	};

	const submitQuickNotice = () => {
		if (!quickActionUser) return;
		const validationError = validateNoticeComposer();
		setErrorMessage("");
		setStatusMessage("");
		setQuickActionError(validationError);
		if (validationError) return;
		startTransition(async () => {
			const result = await createUserNoticeAsAdmin({
				targetType: "user",
				targetUserId: quickActionUser.userId,
				targetEmail: quickActionUser.email,
				...noticePayload(),
			});
			if (!result.success) {
				setQuickActionError(result.error ?? "Unable to create notice.");
				return;
			}
			setQuickActionError("");
			setQuickActionUser(null);
			setQuickActionMode(null);
			resetNoticeComposer("warning");
			setStatusMessage("User notice created.");
			refresh();
		});
	};

	const submitQuickRestriction = () => {
		if (!quickActionUser) return;
		startTransition(async () => {
			const result = await createUserRestrictionAsAdmin({
				userId: quickActionUser.userId,
				email: quickActionUser.email,
				scope: quickRestrictionScope,
				reason: quickRestrictionReason,
				internalNote: quickRestrictionNote,
				expiresAt: normalizeDateTimeForAction(quickRestrictionExpiresAt),
			});
			if (!result.success) {
				setErrorMessage(result.error ?? "Unable to create restriction.");
				return;
			}
			setQuickActionUser(null);
			setQuickActionMode(null);
			setQuickRestrictionReason("");
			setQuickRestrictionNote("");
			setQuickRestrictionExpiresAt("");
			setStatusMessage("User restriction created.");
			refresh();
		});
	};

	const revokeNotice = (noticeId: string) => {
		startTransition(async () => {
			const result = await revokeUserNoticeAsAdmin({ noticeId });
			if (!result.success) {
				setErrorMessage(result.error ?? "Unable to revoke notice.");
				return;
			}
			setStatusMessage("Notice revoked.");
			refresh();
		});
	};

	const appliedQuery = dashboard.query.query?.trim() ?? "";
	const appliedStatus = dashboard.query.status ?? "all";
	const appliedActivity = dashboard.query.activity ?? "all";
	const appliedAudienceSignal = dashboard.query.audienceSignal ?? "all";
	const appliedSortKey = dashboard.query.sortKey ?? "last_seen";
	const appliedSortDirection = dashboard.query.sortDirection ?? "desc";
	const pageWindow = getPageWindow(dashboard.page, dashboard.totalPages);
	const activeFilterChips: Array<{
		key: string;
		label: string;
		value: string;
		clear: () => void;
	}> = [];
	if (appliedQuery) {
		activeFilterChips.push({
			key: "query",
			label: "Search",
			value: appliedQuery,
			clear: () => {
				setQuery("");
				refresh({ nextQuery: "", nextPage: 1 });
			},
		});
	}
	if (appliedStatus !== "all") {
		activeFilterChips.push({
			key: "status",
			label: "Status",
			value: getOptionLabel(STATUS_OPTIONS, appliedStatus),
			clear: () => {
				setStatus("all");
				refresh({ nextStatus: "all", nextPage: 1 });
			},
		});
	}
	if (appliedActivity !== "all") {
		activeFilterChips.push({
			key: "activity",
			label: "Activity",
			value: getOptionLabel(ACTIVITY_OPTIONS, appliedActivity),
			clear: () => {
				setActivity("all");
				refresh({ nextActivity: "all", nextPage: 1 });
			},
		});
	}
	if (appliedAudienceSignal !== "all") {
		activeFilterChips.push({
			key: "audience-signal",
			label: "Segment",
			value: getOptionLabel(AUDIENCE_SIGNAL_OPTIONS, appliedAudienceSignal),
			clear: () => {
				setAudienceSignal("all");
				refresh({ nextAudienceSignal: "all", nextPage: 1 });
			},
		});
	}
	const activeFilterCount = activeFilterChips.length;
	const sortSummary = `${getOptionLabel(SORT_OPTIONS, appliedSortKey)} · ${SORT_DIRECTION_LABELS[appliedSortDirection]}`;
	const ticketReportHistoryLabel = (
		user: Pick<
			AdminUserSummary,
			| "ticketReportCount"
			| "ticketReportsMadeCount"
			| "ticketReportsAgainstListingCount"
		>,
	): string => {
		const madeCount = user.ticketReportsMadeCount ?? 0;
		const againstListingCount = user.ticketReportsAgainstListingCount ?? 0;
		const parts: string[] = [];
		if (againstListingCount > 0) {
			parts.push(
				`${againstListingCount} against their listing${againstListingCount === 1 ? "" : "s"}`,
			);
		}
		if (madeCount > 0) {
			parts.push(`${madeCount} submitted by this user`);
		}
		if (parts.length > 0) return parts.join(" · ");
		return user.ticketReportCount > 0
			? `${user.ticketReportCount} connected report${user.ticketReportCount === 1 ? "" : "s"}`
			: "";
	};
	const pendingReportAgainstListingsLabel = (count: number): string =>
		`${count} open report${count === 1 ? "" : "s"} against their listing${count === 1 ? "" : "s"}`;

	return (
		<div className="space-y-6">
			<Card className="ooo-admin-card min-w-0 overflow-hidden">
				<CardHeader className="border-b">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<CardTitle>User Management</CardTitle>
							<CardDescription>
								Search users, inspect risk signals, and manage person-level
								restrictions and notices.
							</CardDescription>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => refresh()}
							disabled={isPending}
						>
							<RefreshCw />
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-muted/25 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Matching Users
						</p>
						<p className="mt-1 text-lg font-semibold">{dashboard.totalUsers}</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Page {dashboard.page} of {dashboard.totalPages}
						</p>
					</div>
					<div className="rounded-md border bg-muted/25 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Active Restrictions
						</p>
						<p className="mt-1 text-lg font-semibold">
							{dashboard.activeRestrictions.length}
						</p>
					</div>
					<div className="rounded-md border bg-muted/25 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Global Notices
						</p>
						<p className="mt-1 text-lg font-semibold">
							{
								dashboard.globalNotices.filter((notice) => notice.isActive)
									.length
							}
						</p>
					</div>
					<div className="rounded-md border bg-muted/25 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Needs Attention
						</p>
						<p className="mt-1 text-lg font-semibold">
							{dashboard.attentionUserCount}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{ADMIN_USER_ATTENTION_SUMMARY}
						</p>
					</div>
				</CardContent>
			</Card>

			{errorMessage ? (
				<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}
			{statusMessage ? (
				<div className="rounded-lg border bg-muted/45 p-3 text-sm text-muted-foreground">
					{statusMessage}
				</div>
			) : null}

			<section id="user-search" className="scroll-mt-44">
				<Card className="ooo-admin-card min-w-0 overflow-hidden">
					<CardHeader className="border-b">
						<CardTitle>User Search</CardTitle>
						<CardDescription>
							Open a user detail page to see their listings, submissions,
							restrictions, notices, notes, and audit history.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 pt-4">
						<div className="grid gap-3 lg:grid-cols-12 lg:items-start">
							<div className="min-w-0 space-y-1.5 lg:col-span-4">
								<Label htmlFor="user-search-query">Search</Label>
								<Input
									id="user-search-query"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Email, name, or user id"
									onKeyDown={(event) => {
										if (event.key === "Enter") submitSearch();
									}}
								/>
							</div>
							<div className="min-w-0 space-y-1.5 lg:col-span-2">
								<Label htmlFor="user-status-filter">Status</Label>
								<select
									id="user-status-filter"
									value={status}
									onChange={(event) => {
										const nextStatus = event.target.value as
											| ManagedUserStatus
											| "all";
										setStatus(nextStatus);
										refresh({ nextStatus, nextPage: 1 });
									}}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{STATUS_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								<p className="text-xs text-muted-foreground">
									Active is the normal state. Other statuses are exceptions.
								</p>
							</div>
							<div className="min-w-0 space-y-1.5 lg:col-span-3">
								<Label htmlFor="user-activity-filter">Activity</Label>
								<select
									id="user-activity-filter"
									value={activity}
									onChange={(event) => {
										const nextActivity = event.target
											.value as AdminUsersActivityFilter;
										setActivity(nextActivity);
										refresh({ nextActivity, nextPage: 1 });
									}}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{ACTIVITY_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								<p className="text-xs text-muted-foreground">
									Needs attention means{" "}
									{ADMIN_USER_ATTENTION_SUMMARY.toLowerCase()}
								</p>
							</div>
							<div className="min-w-0 space-y-1.5 lg:col-span-4">
								<Label htmlFor="user-sort-key">Sort</Label>
								<select
									id="user-sort-key"
									value={sortKey}
									onChange={(event) => {
										const nextSortKey = event.target.value as AdminUsersSortKey;
										setSortKey(nextSortKey);
										refresh({ nextSortKey, nextPage: 1 });
									}}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{SORT_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
							<div className="min-w-0 space-y-1.5 lg:col-span-3">
								<Label htmlFor="user-sort-direction">Direction</Label>
								<select
									id="user-sort-direction"
									value={sortDirection}
									onChange={(event) => {
										const nextSortDirection = event.target
											.value as AdminUsersSortDirection;
										setSortDirection(nextSortDirection);
										refresh({ nextSortDirection, nextPage: 1 });
									}}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									<option value="desc">High/new first</option>
									<option value="asc">Low/old first</option>
								</select>
							</div>
							<div className="min-w-0 space-y-1.5 lg:col-span-2">
								<Label htmlFor="user-page-size">Rows</Label>
								<select
									id="user-page-size"
									value={pageSize}
									onChange={(event) => {
										const nextPageSize = Number(event.target.value);
										setPageSize(nextPageSize);
										refresh({ nextPageSize, nextPage: 1 });
									}}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									<option value={25}>25</option>
									<option value={50}>50</option>
									<option value={100}>100</option>
								</select>
							</div>
							<Button
								type="button"
								className="w-full lg:col-span-3 lg:self-end"
								onClick={submitSearch}
								disabled={isPending}
							>
								<Search />
								Search
							</Button>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									title={ADMIN_USER_ATTENTION_DETAIL}
									onClick={() => {
										setActivity("needs_attention");
										refresh({ nextActivity: "needs_attention", nextPage: 1 });
									}}
								>
									<Filter />
									Needs attention
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => {
										setQuery("");
										setStatus("all");
										setActivity("all");
										setAudienceSignal("all");
										setSortKey("last_seen");
										setSortDirection("desc");
										refresh({
											nextQuery: "",
											nextStatus: "all",
											nextActivity: "all",
											nextAudienceSignal: "all",
											nextSortKey: "last_seen",
											nextSortDirection: "desc",
											nextPage: 1,
										});
									}}
								>
									Reset filters
								</Button>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-xs text-muted-foreground">
									Selected {selectedUsers.length}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={toggleVisibleSelection}
									disabled={dashboard.users.length === 0}
								>
									<CheckSquare />
									{allVisibleSelected ? "Clear Page" : "Select Page"}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										selectedUsers.length > 0
											? exportAdminUsersCsv(
													selectedUsers,
													"fete-finder-selected-users",
												)
											: exportAdminUsersCsv(
													dashboard.users,
													"fete-finder-visible-users",
												)
									}
									disabled={dashboard.users.length === 0}
								>
									<Download />
									{selectedUsers.length > 0 ? "Export Selected" : "Export Page"}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void copySelectedUserEmails()}
									disabled={selectedUsers.length === 0}
								>
									<Copy />
									Copy Selected
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void exportAsCSV()}
									disabled={emails.length === 0}
								>
									<Download />
									Export Audience CSV
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setIsAudienceImportOpen(true)}
								>
									<Upload />
									Import
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={() => void deleteSelectedAudienceRecords()}
									disabled={
										isAudienceMutationPending ||
										selectedAudienceRecords.length === 0
									}
									title="Removes selected records from the collected audience store, not canonical user accounts."
								>
									<Trash2 />
									Remove Audience Records
								</Button>
							</div>
						</div>
						<div className="rounded-lg border bg-muted/20 p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="text-sm font-medium">
										{activeFilterCount} active filter
										{activeFilterCount === 1 ? "" : "s"}
									</p>
									<p className="text-xs text-muted-foreground">
										Sort: {sortSummary}
									</p>
									{appliedActivity === "needs_attention" ? (
										<p className="mt-1 text-xs text-muted-foreground">
											{ADMIN_USER_ATTENTION_DETAIL}
										</p>
									) : null}
								</div>
								{activeFilterCount > 0 ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setQuery("");
											setStatus("all");
											setActivity("all");
											setAudienceSignal("all");
											refresh({
												nextQuery: "",
												nextStatus: "all",
												nextActivity: "all",
												nextAudienceSignal: "all",
												nextPage: 1,
											});
										}}
									>
										Clear filters
									</Button>
								) : null}
							</div>
							{activeFilterCount > 0 ? (
								<div className="mt-3 flex flex-wrap gap-2">
									{activeFilterChips.map((chip) => (
										<button
											key={chip.key}
											type="button"
											className="inline-flex min-h-8 items-center gap-2 rounded-md border bg-background/70 px-2.5 py-1 text-left text-xs transition-colors hover:bg-muted"
											onClick={chip.clear}
										>
											<span className="font-medium text-muted-foreground">
												{chip.label}
											</span>
											<span className="max-w-48 truncate text-foreground">
												{chip.value}
											</span>
											<X className="size-3.5 text-muted-foreground" />
										</button>
									))}
								</div>
							) : (
								<p className="mt-3 text-xs text-muted-foreground">
									No filters applied. You are viewing all known users.
								</p>
							)}
						</div>

						<div className="rounded-lg border bg-muted/10 p-3">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p className="text-sm font-medium">Audience Snapshot</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Use cohorts here to narrow the canonical user list. Open
										Quick Profile for per-user behavior and device context.
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={isAudienceLoading}
										onClick={() => void loadEmails()}
									>
										<RefreshCw />
										Refresh data
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={audienceSignal === "all" || isPending}
										onClick={() => {
											setAudienceSignal("all");
											refresh({ nextAudienceSignal: "all", nextPage: 1 });
										}}
									>
										Clear segment
									</Button>
								</div>
							</div>
							{audienceSnapshotMessage ? (
								<p className="mt-3 rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
									{audienceSnapshotMessage}
								</p>
							) : null}
							<div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-5">
								<div className="rounded-md border bg-background/55 px-2.5 py-2">
									<span className="block uppercase tracking-[0.14em]">New</span>
									<span className="mt-1 block font-medium text-foreground tabular-nums">
										{audiencePairCount(
											newRegistrations.last24h,
											newRegistrations.last7d,
										)}
									</span>
									<span>24h / 7d</span>
								</div>
								<div className="rounded-md border bg-background/55 px-2.5 py-2">
									<span className="block uppercase tracking-[0.14em]">
										Seen
									</span>
									<span className="mt-1 block font-medium text-foreground tabular-nums">
										{audiencePairCount(
											emailAnalytics?.submissionsLast24Hours,
											emailAnalytics?.submissionsLast7Days,
										)}
									</span>
									<span>24h / 7d</span>
								</div>
								<div className="rounded-md border bg-background/55 px-2.5 py-2">
									<span className="block uppercase tracking-[0.14em]">
										Linked
									</span>
									<span className="mt-1 block font-medium text-foreground tabular-nums">
										{isAudienceLoading
											? "Loading"
											: hasAudienceLoaded
												? `${emailAnalytics?.linkedBehaviorUsers ?? 0}/${emails.length}`
												: "Pending"}
									</span>
									<span>activity records</span>
								</div>
								<div className="rounded-md border bg-background/55 px-2.5 py-2">
									<span className="block uppercase tracking-[0.14em]">
										Tests
									</span>
									<span className="mt-1 block font-medium text-foreground tabular-nums">
										{audienceCount(likelyTestCount)}
									</span>
									<span>subtle row badge</span>
								</div>
								<div className="rounded-md border bg-background/55 px-2.5 py-2">
									<span className="block uppercase tracking-[0.14em]">
										Common Context
									</span>
									<span className="mt-1 block truncate font-medium text-foreground">
										{audienceContextSummary()}
									</span>
									<span className="block truncate">
										{audienceContextDetail()}
									</span>
								</div>
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								{AUDIENCE_SIGNAL_OPTIONS.filter(
									(option) => option.value !== "all",
								).map((option) => (
									<Button
										key={option.value}
										type="button"
										variant={
											audienceSignal === option.value ? "default" : "outline"
										}
										size="sm"
										onClick={() => {
											const nextAudienceSignal =
												audienceSignal === option.value ? "all" : option.value;
											setAudienceSignal(nextAudienceSignal);
											refresh({ nextAudienceSignal, nextPage: 1 });
										}}
										disabled={isPending}
									>
										{option.label}
										<span className="tabular-nums">
											{audienceCount(audienceSegmentCounts.get(option.value))}
										</span>
									</Button>
								))}
							</div>
						</div>

						<div className="grid gap-3">
							{dashboard.users.length > 0 ? (
								dashboard.users.map((user) => {
									const attentionReasons = getAdminUserAttentionReasons(user);
									const ticketReportHistory = ticketReportHistoryLabel(user);
									const isSelected = selectedUserIdSet.has(user.userId);
									const audienceRecord = emailRecordsByEmail.get(
										user.email.trim().toLowerCase(),
									);
									const behaviorSignalCount =
										audienceRecord?.linkedSignalCount ??
										user.audienceSignalCount ??
										0;
									const behaviorSignalTitle = `Searches ${
										audienceRecord?.searchSignalCount ??
										user.audienceSearchCount ??
										0
									}; filters ${
										audienceRecord?.filterSignalCount ??
										user.audienceFilterCount ??
										0
									}; plans ${
										audienceRecord?.planActionSignalCount ??
										user.audiencePlanSignalCount ??
										0
									}; events ${
										audienceRecord?.eventActionSignalCount ??
										user.audienceEventCount ??
										0
									}; genres ${
										audienceRecord?.genrePreferenceSignalCount ??
										user.audienceGenreCount ??
										0
									}`;
									return (
										<div
											key={user.userId}
											className="grid gap-3 rounded-lg border bg-background/70 p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
										>
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleUserSelection(user.userId)}
												className="mt-1 size-4 rounded border-input lg:mt-0"
												aria-label={`Select ${user.email}`}
											/>
											<div className="min-w-0 space-y-2">
												<div className="flex flex-wrap items-center gap-2">
													{isLikelyTestEmail(user.email) ? (
														<Badge variant="outline">Likely test</Badge>
													) : null}
													{user.status !== "active" ? (
														<Badge variant={statusVariant(user.status)}>
															{statusLabel(user.status)}
														</Badge>
													) : null}
													{user.activeRestrictionCount > 0 ? (
														<Badge variant="destructive">
															<ShieldAlert />
															{user.activeRestrictionCount} restriction
															{user.activeRestrictionCount === 1 ? "" : "s"}
														</Badge>
													) : null}
													{user.openNoticeCount > 0 ? (
														<Badge variant="outline">
															<Bell />
															{user.openNoticeCount} pending direct notice
															{user.openNoticeCount === 1 ? "" : "s"}
														</Badge>
													) : null}
													{user.openTicketReportCount > 0 ? (
														<Badge variant="destructive">
															<AlertTriangle />
															{pendingReportAgainstListingsLabel(
																user.openTicketReportCount,
															)}
														</Badge>
													) : null}
												</div>
												<div>
													<p className="truncate text-base font-semibold">
														{userDisplayName(user)}
													</p>
													<p className="truncate text-sm text-muted-foreground">
														{user.email} · {user.userId}
													</p>
												</div>
												{attentionReasons.length > 0 ? (
													<div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100">
														<span className="font-medium">
															Needs attention:
														</span>{" "}
														{attentionReasons.join(" · ")}
													</div>
												) : null}
												<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
													<span>
														Last seen {formatDateTime(user.lastSeenAt)}
													</span>
													{behaviorSignalCount > 0 ? (
														<span title={behaviorSignalTitle}>
															Behavior {behaviorSignalCount}
														</span>
													) : null}
													<UserStat
														count={user.ticketListingCount}
														singular="listing"
														href={userSectionHref(user, "ticket-exchange")}
													/>
													{user.openTicketReportCount > 0 ? (
														<Link
															href={userSectionHref(user, "ticket-exchange")}
															className={userStatLinkClass}
														>
															{pendingReportAgainstListingsLabel(
																user.openTicketReportCount,
															)}
														</Link>
													) : null}
													{ticketReportHistory ? (
														<Link
															href={userSectionHref(user, "ticket-exchange")}
															className={userStatLinkClass}
														>
															Ticket reports: {ticketReportHistory}
														</Link>
													) : null}
													<UserStat
														count={user.eventSubmissionCount}
														singular="submission"
														href={userSectionHref(user, "submissions-plans")}
													/>
													<UserStat
														count={user.planCount}
														singular="route"
														href={userSectionHref(user, "submissions-plans")}
													/>
													<UserStat
														count={user.savedEventCount}
														singular="saved event"
														href={userSectionHref(user, "submissions-plans")}
													/>
												</div>
											</div>
											<div className="flex flex-wrap gap-2 lg:justify-end">
												<Button
													type="button"
													variant="outline"
													size="icon-sm"
													title="Copy email"
													onClick={() => void copyValue("Email", user.email)}
												>
													<Copy />
												</Button>
												<Button
													type="button"
													variant="outline"
													size="icon-sm"
													title="Copy user ID"
													onClick={() => void copyValue("User ID", user.userId)}
												>
													<Fingerprint />
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => void openQuickProfile(user)}
													disabled={isQuickProfileLoading}
												>
													<Eye />
													Quick Profile
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => openQuickAction(user, "notice")}
												>
													<Send />
													Notice
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => openQuickAction(user, "restriction")}
												>
													<Ban />
													Restrict
												</Button>
												<Link
													href={withAdminBasePath(
														`/admin/users/${encodeURIComponent(user.userId)}`,
													)}
												>
													<Button type="button" variant="outline" size="sm">
														<UserRound />
														Open User
													</Button>
												</Link>
											</div>
										</div>
									);
								})
							) : (
								<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
									No users match this search.
								</div>
							)}
						</div>
						<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
							<p className="text-sm text-muted-foreground">
								Showing{" "}
								{dashboard.totalUsers === 0
									? 0
									: (dashboard.page - 1) * dashboard.pageSize + 1}
								-
								{Math.min(
									dashboard.page * dashboard.pageSize,
									dashboard.totalUsers,
								)}{" "}
								of {dashboard.totalUsers}
							</p>
							<div className="flex flex-wrap gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || dashboard.page <= 1}
									onClick={() => refresh({ nextPage: 1 })}
								>
									<ChevronsLeft />
									First
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || dashboard.page <= 1}
									onClick={() => refresh({ nextPage: dashboard.page - 1 })}
								>
									<ChevronLeft />
									Previous
								</Button>
								{pageWindow.map((pageNumber) => (
									<Button
										key={pageNumber}
										type="button"
										variant={
											pageNumber === dashboard.page ? "default" : "outline"
										}
										size="sm"
										disabled={isPending || pageNumber === dashboard.page}
										onClick={() => refresh({ nextPage: pageNumber })}
										aria-current={
											pageNumber === dashboard.page ? "page" : undefined
										}
									>
										{pageNumber}
									</Button>
								))}
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || dashboard.page >= dashboard.totalPages}
									onClick={() => refresh({ nextPage: dashboard.page + 1 })}
								>
									Next
									<ChevronRight />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || dashboard.page >= dashboard.totalPages}
									onClick={() => refresh({ nextPage: dashboard.totalPages })}
								>
									Last
									<ChevronsRight />
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</section>

			<section id="active-restrictions" className="scroll-mt-44">
				<Card className="ooo-admin-card min-w-0 overflow-hidden">
					<CardHeader className="border-b">
						<CardTitle>Active Restrictions</CardTitle>
						<CardDescription>
							Account and action blocks currently being enforced by server-side
							policy checks.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 pt-4">
						{dashboard.activeRestrictions.length > 0 ? (
							dashboard.activeRestrictions.map((restriction) => (
								<div
									key={restriction.id}
									className="rounded-lg border bg-background/70 p-3"
								>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="destructive">
											<AlertTriangle />
											{restrictionScopeLabel(restriction.scope)}
										</Badge>
										<Badge variant="outline">
											{restriction.expiresAt
												? `Expires ${formatDateTime(restriction.expiresAt)}`
												: "No expiry"}
										</Badge>
									</div>
									<p className="mt-2 text-sm font-medium">
										{restriction.email ?? restriction.userId}
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{restriction.reason}
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<Link
											href={withAdminBasePath(
												`/admin/users/${encodeURIComponent(
													restriction.userId ?? restriction.email ?? "",
												)}`,
											)}
										>
											<Button type="button" variant="outline" size="sm">
												<UserRound />
												Open User
											</Button>
										</Link>
									</div>
								</div>
							))
						) : (
							<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
								No active restrictions.
							</div>
						)}
					</CardContent>
				</Card>
			</section>

			<section id="global-notices" className="scroll-mt-44">
				<Card className="ooo-admin-card min-w-0 overflow-hidden">
					<CardHeader className="border-b">
						<CardTitle>Global Notices</CardTitle>
						<CardDescription>
							Send global, signed-in-only, or segment notices shown on the next
							site visit.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 pt-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
						<div className="space-y-3 rounded-lg border bg-background/70 p-3">
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="notice-target">Target</Label>
									<select
										id="notice-target"
										value={noticeTargetType}
										onChange={(event) =>
											setNoticeTargetType(
												event.target.value as UserNoticeTargetType,
											)
										}
										className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
									>
										{TARGET_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="notice-severity">Level</Label>
									<select
										id="notice-severity"
										value={noticeSeverity}
										onChange={(event) =>
											setNoticeSeverity(
												event.target.value as UserNoticeSeverity,
											)
										}
										className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
									>
										{SEVERITY_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
							</div>
							{noticeTargetType === "segment" ? (
								<div className="space-y-1.5">
									<Label htmlFor="notice-segment">Segment</Label>
									<select
										id="notice-segment"
										value={segmentKey}
										onChange={(event) => setSegmentKey(event.target.value)}
										className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
									>
										{SEGMENT_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</div>
							) : null}
							<div className="space-y-1.5">
								<Label htmlFor="notice-title">Title</Label>
								<Input
									id="notice-title"
									value={noticeTitle}
									onChange={(event) => setNoticeTitle(event.target.value)}
									placeholder="Notice title"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="notice-body">Body</Label>
								<Textarea
									id="notice-body"
									value={noticeBody}
									onChange={(event) => setNoticeBody(event.target.value)}
									placeholder="Short message shown to users"
									rows={4}
								/>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="notice-cta-label">CTA Label</Label>
									<Input
										id="notice-cta-label"
										value={noticeCtaLabel}
										onChange={(event) => setNoticeCtaLabel(event.target.value)}
										placeholder="Optional"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="notice-cta-href">CTA Link</Label>
									<Input
										id="notice-cta-href"
										value={noticeCtaHref}
										onChange={(event) => setNoticeCtaHref(event.target.value)}
										placeholder="/tickets or example.com"
									/>
								</div>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
									<input
										type="checkbox"
										checked={noticeRequiresAck}
										onChange={(event) =>
											setNoticeAcknowledgementRequired(event.target.checked)
										}
									/>
									Requires acknowledgement
								</label>
								<label
									className={cn(
										"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
										noticeRequiresAck && "opacity-60",
									)}
								>
									<input
										type="checkbox"
										checked={!noticeRequiresAck && noticeDismissible}
										disabled={noticeRequiresAck}
										onChange={(event) =>
											setNoticeDismissible(event.target.checked)
										}
									/>
									Dismissible with X
								</label>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="notice-starts">Starts At</Label>
								<Input
									id="notice-starts"
									type="datetime-local"
									value={noticeStartsAt}
									onChange={(event) => setNoticeStartsAt(event.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									Leave blank to publish immediately. A future start time queues
									the notice until that moment.
								</p>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="notice-expires">Expires At</Label>
								<Input
									id="notice-expires"
									type="datetime-local"
									value={noticeExpiresAt}
									onChange={(event) => setNoticeExpiresAt(event.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									Defaults to 14 days. Clear only when the notice should remain
									until dismissed, acknowledged, or revoked.
								</p>
							</div>
							<div className="rounded-lg border bg-muted/20 p-3">
								<div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									<Eye className="size-3.5" />
									Preview
								</div>
								<div
									className={cn(
										"ooo-notice-card border p-3 pl-4",
										noticeSeverityClass(noticeSeverity),
									)}
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="ooo-notice-eyebrow text-[10px] font-medium uppercase tracking-[0.18em]">
											{noticeSeverityLabel(noticeSeverity)}
										</p>
										<p className="text-xs text-muted-foreground">
											{noticeStartsAt
												? `Queued for ${formatDateTime(noticeStartsAt)}`
												: "Publishes immediately"}
										</p>
									</div>
									<p className="ooo-notice-title mt-2 text-[1.15rem] leading-tight">
										{noticeTitle || "Notice title"}
									</p>
									<p className="mt-2 text-sm text-foreground/75">
										{noticeBody || "Notice body preview"}
									</p>
									{noticeExpiresAt ? (
										<p className="mt-2 text-xs text-muted-foreground">
											Visible until {formatDateTime(noticeExpiresAt)}
										</p>
									) : null}
								</div>
							</div>
							{noticeComposerError ? (
								<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
									{noticeComposerError}
								</div>
							) : null}
							<Button
								type="button"
								onClick={submitGlobalNotice}
								disabled={isPending}
							>
								<Bell />
								{isPending ? "Creating..." : "Create Notice"}
							</Button>
						</div>

						<div className="space-y-3">
							{dashboard.globalNotices.length > 0 ? (
								dashboard.globalNotices.map((notice) => {
									const status = noticeStatus(notice);
									const canRevokeNotice = canRevokeNoticeStatus(status);
									return (
										<div
											key={notice.id}
											className={cn(
												"ooo-notice-card border p-3 pl-4",
												noticeSeverityClass(notice.severity),
											)}
										>
											<div className="flex flex-wrap items-start justify-between gap-2">
												<div>
													<p className="ooo-notice-eyebrow text-[10px] font-medium uppercase tracking-[0.18em]">
														{noticeSeverityLabel(notice.severity)}
													</p>
													<p className="ooo-notice-title mt-1 text-[1.12rem] leading-tight">
														{notice.title}
													</p>
												</div>
												<p className="text-xs font-medium text-muted-foreground">
													{noticeTargetLabel(
														notice.targetType,
														notice.segmentKey,
													)}{" "}
													· {noticeLifecycleLabel(status)}
												</p>
											</div>
											<p className="mt-2 line-clamp-2 text-sm text-foreground/75">
												{notice.body}
											</p>
											<p className="mt-2 text-xs text-muted-foreground">
												Starts {formatDateTime(notice.startsAt)}
												{notice.expiresAt
													? ` · visible until ${formatDateTime(notice.expiresAt)}`
													: " · no expiry"}
											</p>
											<div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
												<span>Delivered {notice.deliveredCount ?? 0}</span>
												<span>Read {notice.readCount ?? 0}</span>
												<span>Ack {notice.acknowledgedCount ?? 0}</span>
												<span>Dismissed {notice.dismissedCount ?? 0}</span>
											</div>
											<div className="mt-3 flex flex-wrap gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="ooo-notice-secondary-action bg-background/45"
													onClick={() => {
														setNoticeTargetType(notice.targetType);
														setSegmentKey(
															notice.segmentKey ?? "all_known_users",
														);
														setNoticeSeverity(notice.severity);
														setNoticeTitle(notice.title);
														setNoticeBody(notice.body);
														setNoticeCtaLabel(notice.ctaLabel ?? "");
														setNoticeCtaHref(notice.ctaHref ?? "");
														setNoticeRequiresAck(notice.requiresAck);
														setNoticeDismissible(
															notice.requiresAck ? false : notice.dismissible,
														);
														setNoticeStartsAt("");
														setNoticeExpiresAt(
															getDefaultNoticeExpiresAtInputValue(),
														);
														setStatusMessage("Notice copied into composer.");
													}}
												>
													<Copy />
													Duplicate
												</Button>
												{canRevokeNotice ? (
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={isPending}
														className="ooo-notice-secondary-action bg-background/45"
														onClick={() => revokeNotice(notice.id)}
													>
														Revoke
													</Button>
												) : null}
											</div>
										</div>
									);
								})
							) : (
								<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
									No global or segment notices yet.
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</section>

			<Dialog
				open={isAudienceImportOpen}
				onOpenChange={(open) => {
					setIsAudienceImportOpen(open);
					if (!open) setAudienceImportStatus("");
				}}
			>
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Import Audience Records</DialogTitle>
						<DialogDescription>
							Append or update collected email records. This feeds exports and
							behavior signals without replacing the canonical user list.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="rounded-lg border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
							Source: {emailStore?.provider ?? "unknown"} · Records:{" "}
							{emails.length}
						</div>
						<Textarea
							value={audienceImportText}
							onChange={(event) => setAudienceImportText(event.target.value)}
							placeholder="Paste CSV with an Email column, or one email per line"
							rows={7}
						/>
						<input
							ref={audienceImportFileInputRef}
							type="file"
							accept=".csv,text/csv"
							onChange={(event) => void handleAudienceCsvSelected(event)}
							className="hidden"
						/>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => audienceImportFileInputRef.current?.click()}
								disabled={isAudienceMutationPending}
							>
								<FileUp />
								Upload CSV
							</Button>
							<Button
								type="button"
								onClick={() =>
									void handleAudienceImport(audienceImportText, "pasted")
								}
								disabled={
									isAudienceMutationPending || !audienceImportText.trim()
								}
							>
								<Upload />
								Import Paste
							</Button>
						</div>
						{audienceImportStatus ? (
							<div className="rounded-lg border bg-muted/25 p-3 text-sm text-muted-foreground">
								{audienceImportStatus}
							</div>
						) : null}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(quickProfileUser)}
				onOpenChange={(open) => {
					if (!open) closeQuickProfile();
				}}
			>
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Quick Profile</DialogTitle>
						<DialogDescription>
							Fast behavior and context check for this user.
						</DialogDescription>
					</DialogHeader>
					{isQuickProfileLoading ? (
						<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
							Loading behavior profile...
						</div>
					) : quickProfile ? (
						<div className="space-y-4">
							<div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3">
								<div className="min-w-0">
									<p className="truncate text-sm font-semibold">
										{collectedProfileDisplayName(quickProfile)}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										{quickProfile.user.email}
									</p>
								</div>
								<Link
									href={buildAdminUserHref(
										quickProfile.user.userId,
										quickProfile.user.email,
									)}
								>
									<Button type="button" variant="outline" size="sm">
										<ExternalLink />
										Full Detail
									</Button>
								</Link>
							</div>
							<div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
								{[
									{
										label: "Linked Activity",
										value: quickProfile.user.linkedSignalCount ?? 0,
									},
									{
										label: "Searches",
										value: quickProfile.user.searchSignalCount ?? 0,
									},
									{
										label: "Filters",
										value: quickProfile.user.filterSignalCount ?? 0,
									},
									{
										label: "Plans",
										value: quickProfile.user.planActionSignalCount ?? 0,
									},
									{
										label: "Events",
										value: quickProfile.user.eventActionSignalCount ?? 0,
									},
									{
										label: "Genres",
										value: quickProfile.user.genrePreferenceSignalCount ?? 0,
									},
								].map((item) => (
									<div
										key={item.label}
										className="rounded-md border bg-muted/20 px-3 py-2"
									>
										<p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
											{item.label}
										</p>
										<p className="mt-1 text-sm font-medium tabular-nums">
											{item.value}
										</p>
									</div>
								))}
							</div>
							<div className="rounded-lg border bg-muted/20 p-3">
								<p className="text-sm font-medium">Context</p>
								<div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
									{[
										{
											label: "Device",
											value: quickProfile.user.deviceClass,
										},
										{
											label: "Platform",
											value: quickProfile.user.platform,
										},
										{
											label: "Browser",
											value: quickProfile.user.browserFamily,
										},
										{
											label: "Timezone",
											value: quickProfile.user.timezone,
										},
										{
											label: "Locale",
											value: quickProfile.user.locale,
										},
									].map((item) => (
										<p
											key={item.label}
											className="rounded-md border bg-background/55 px-2.5 py-2"
										>
											<span className="block text-[10px] uppercase tracking-[0.14em]">
												{item.label}
											</span>
											<span className="mt-1 block truncate font-medium text-foreground">
												{compactContextValue(item.value)}
											</span>
										</p>
									))}
								</div>
							</div>
							<div className="grid gap-3 lg:grid-cols-2">
								<div className="rounded-lg border bg-muted/20 p-3">
									<p className="text-sm font-medium">Top Genres</p>
									<div className="mt-2 space-y-1.5 text-xs">
										{quickProfile.genrePreferences.length > 0 ? (
											quickProfile.genrePreferences.slice(0, 6).map((item) => (
												<p
													key={item.genre}
													className="flex justify-between gap-2"
												>
													<span className="truncate">{item.genre}</span>
													<span className="text-muted-foreground">
														score {item.score}
													</span>
												</p>
											))
										) : (
											<p className="text-muted-foreground">
												No genre activity.
											</p>
										)}
									</div>
								</div>
								<div className="rounded-lg border bg-muted/20 p-3">
									<p className="text-sm font-medium">Recent Event Actions</p>
									<div className="mt-2 space-y-1.5 text-xs">
										{quickProfile.recentEventActions.length > 0 ? (
											quickProfile.recentEventActions
												.slice(0, 6)
												.map((item) => (
													<p
														key={`${item.eventKey}-${item.actionType}-${item.recordedAt}`}
														className="flex justify-between gap-2"
													>
														<span className="truncate">
															{item.actionType} ·{" "}
															{item.eventName ?? item.eventKey}
														</span>
														<span className="shrink-0 text-muted-foreground">
															{formatDateTime(item.recordedAt)}
														</span>
													</p>
												))
										) : (
											<p className="text-muted-foreground">
												No event actions linked.
											</p>
										)}
									</div>
								</div>
							</div>
						</div>
					) : (
						<div className="space-y-3 rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
							<p>{quickProfileStatus || "No behavior profile available."}</p>
							{quickProfileUser ? (
								<Link
									href={buildAdminUserHref(
										quickProfileUser.userId,
										quickProfileUser.email,
									)}
								>
									<Button type="button" variant="outline" size="sm">
										<ExternalLink />
										Full Detail
									</Button>
								</Link>
							) : null}
						</div>
					)}
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(quickActionUser && quickActionMode === "notice")}
				onOpenChange={(open) => {
					if (!open) {
						setQuickActionError("");
						setQuickActionUser(null);
						setQuickActionMode(null);
					}
				}}
			>
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Send User Notice</DialogTitle>
						<DialogDescription>
							{quickActionUser
								? `Send an in-app notice to ${quickActionUser.email}.`
								: "Send an in-app notice."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<select
							value={noticeSeverity}
							onChange={(event) =>
								setNoticeSeverity(event.target.value as UserNoticeSeverity)
							}
							className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
						>
							{SEVERITY_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<Input
							value={noticeTitle}
							onChange={(event) => setNoticeTitle(event.target.value)}
							placeholder="Notice title"
						/>
						<Textarea
							value={noticeBody}
							onChange={(event) => setNoticeBody(event.target.value)}
							placeholder="Notice body"
							rows={4}
						/>
						<div className="grid gap-2 sm:grid-cols-2">
							<Input
								value={noticeCtaLabel}
								onChange={(event) => setNoticeCtaLabel(event.target.value)}
								placeholder="CTA label"
							/>
							<Input
								value={noticeCtaHref}
								onChange={(event) => setNoticeCtaHref(event.target.value)}
								placeholder="/tickets or example.com"
							/>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
								<input
									type="checkbox"
									checked={noticeRequiresAck}
									onChange={(event) =>
										setNoticeAcknowledgementRequired(event.target.checked)
									}
								/>
								Requires acknowledgement
							</label>
							<label
								className={cn(
									"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
									noticeRequiresAck && "opacity-60",
								)}
							>
								<input
									type="checkbox"
									checked={!noticeRequiresAck && noticeDismissible}
									disabled={noticeRequiresAck}
									onChange={(event) =>
										setNoticeDismissible(event.target.checked)
									}
								/>
								Dismissible with X
							</label>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<div className="space-y-1.5">
								<Label>Starts At</Label>
								<Input
									type="datetime-local"
									value={noticeStartsAt}
									onChange={(event) => setNoticeStartsAt(event.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label>Expires At</Label>
								<Input
									type="datetime-local"
									value={noticeExpiresAt}
									onChange={(event) => setNoticeExpiresAt(event.target.value)}
								/>
								<p className="text-xs text-muted-foreground">
									Defaults to 14 days.
								</p>
							</div>
						</div>
						{quickActionError ? (
							<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
								{quickActionError}
							</div>
						) : null}
						<Button
							type="button"
							onClick={submitQuickNotice}
							disabled={isPending}
						>
							<Bell />
							{isPending ? "Sending..." : "Send Notice"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={Boolean(quickActionUser && quickActionMode === "restriction")}
				onOpenChange={(open) => {
					if (!open) {
						setQuickActionUser(null);
						setQuickActionMode(null);
					}
				}}
			>
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Add Restriction</DialogTitle>
						<DialogDescription>
							{quickActionUser
								? `Apply an action-level restriction to ${quickActionUser.email}.`
								: "Apply an action-level restriction."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<select
							value={quickRestrictionScope}
							onChange={(event) =>
								setQuickRestrictionScope(
									event.target.value as UserRestrictionScope,
								)
							}
							className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
						>
							{RESTRICTION_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<Input
							value={quickRestrictionReason}
							onChange={(event) =>
								setQuickRestrictionReason(event.target.value)
							}
							placeholder="User-facing reason"
						/>
						<Textarea
							value={quickRestrictionNote}
							onChange={(event) => setQuickRestrictionNote(event.target.value)}
							placeholder="Internal note"
							rows={3}
						/>
						<div className="space-y-1.5">
							<Label>Expires At</Label>
							<Input
								type="datetime-local"
								value={quickRestrictionExpiresAt}
								onChange={(event) =>
									setQuickRestrictionExpiresAt(event.target.value)
								}
							/>
						</div>
						<Button
							type="button"
							variant="outline"
							onClick={submitQuickRestriction}
							disabled={isPending}
						>
							<Ban />
							Add Restriction
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
