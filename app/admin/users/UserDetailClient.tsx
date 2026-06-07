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
import { getTicketExchangeReportReasonLabel } from "@/features/ticket-exchange/reporting";
import type { TicketExchangeAdminReport } from "@/features/ticket-exchange/types";
import {
	addUserAdminNoteAsAdmin,
	bulkUpdateUserTicketListingsAsAdmin,
	createUserNoticeAsAdmin,
	createUserRestrictionAsAdmin,
	getAdminUserDetail,
	revokeUserNoticeAsAdmin,
	revokeUserRestrictionAsAdmin,
	updateManagedUserStatusAsAdmin,
	updateUserTicketListingAsAdmin,
} from "@/features/users/admin-actions";
import {
	getDefaultNoticeExpiresAtInputValue,
	getNoticeCtaHrefError,
	getNoticeLifecycleError,
	normalizeNoticeCtaHref,
} from "@/features/users/notice-form";
import type {
	AdminPlanDetail,
	AdminUserDetail,
	ManagedUserStatus,
	UserAdminNoteCategory,
	UserNotice,
	UserNoticeSeverity,
	UserNoticeTargetType,
	UserRestrictionScope,
} from "@/features/users/types";
import {
	USER_ADMIN_NOTE_CATEGORIES,
	USER_NOTICE_SEVERITIES,
	USER_RESTRICTION_SCOPES,
} from "@/features/users/types";
import { cn } from "@/lib/utils";
import {
	Ban,
	Bell,
	Check,
	Copy,
	ExternalLink,
	Eye,
	MessageSquare,
	Pause,
	RefreshCw,
	ShieldAlert,
	Trash2,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
	RECENT_LIST_HELP_TEXT,
	buildAdminUserHref,
	buildAudienceFilterHref,
	buildAudienceSearchHref,
	formatAudienceContextValue,
	getAudienceFilterDisplayValue,
	getAudienceFilterGroupLabel,
} from "../components/audience-profile-utils";
import { withAdminBasePath } from "../config";

type UserDetailClientProps = {
	lookup: string;
	initialPayload: {
		success: boolean;
		detail?: AdminUserDetail;
		error?: string;
	};
};

const STATUS_OPTIONS: Array<{ value: ManagedUserStatus; label: string }> = [
	{ value: "active", label: "Active" },
	{ value: "blocked", label: "Blocked" },
	{ value: "unsubscribed", label: "Unsubscribed" },
	{ value: "deleted", label: "Deleted" },
];

const RESTRICTION_LABELS: Record<UserRestrictionScope, string> = {
	all_user_actions: "All user actions",
	"auth.login": "Login",
	"ticket_exchange.post": "Ticket posting",
	"ticket_exchange.contact_unlock": "Ticket contact unlocks",
	"ticket_exchange.report": "Ticket reports",
	"event_submission.create": "Event submissions",
	"plans.sync": "Route syncing",
	"saved_events.sync": "Saved events",
	"user_preferences.write": "Preference writes",
	"app_settings.sync": "App settings sync",
};

const ADMIN_NOTE_LABELS: Record<UserAdminNoteCategory, string> = {
	general: "General",
	policy: "Policy",
	support: "Support",
	fraud: "Fraud",
	privacy: "Privacy",
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

const noticeVariant = (severity: UserNoticeSeverity) =>
	severity === "critical" || severity === "action_required"
		? ("destructive" as const)
		: ("outline" as const);

const noticeSeverityLabel = (severity: UserNoticeSeverity): string => {
	switch (severity) {
		case "critical":
			return "Critical";
		case "action_required":
			return "Action required";
		case "warning":
			return "Warning";
		case "success":
			return "Success";
		case "info":
		default:
			return "Info";
	}
};

const noticeTargetLabel = (
	targetType: UserNoticeTargetType,
	segmentKey?: string | null,
): string => {
	switch (targetType) {
		case "user":
			return "Direct user notice";
		case "email":
			return "Email-targeted notice";
		case "authenticated_users":
			return "All signed-in users";
		case "segment":
			return segmentKey ? `Segment: ${segmentKey}` : "Segment notice";
		case "global":
		default:
			return "Global notice";
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
		? { label: "Active policy", variant: "outline" }
		: { label: "Inactive", variant: "outline" };
};

const shouldShowNoticeLifecycleBadge = (
	status: ReturnType<typeof noticeStatus>,
): boolean => status.label !== "Active policy";

const canRevokeNoticeStatus = (
	status: ReturnType<typeof noticeStatus>,
): boolean => status.label === "Active policy" || status.label === "Scheduled";

const noticeRecipientStatus = (
	notice: UserNotice,
): { label: string; variant: "default" | "outline" | "destructive" } | null => {
	if (notice.recipientAcknowledgedAt) {
		return { label: "Acknowledged by user", variant: "outline" };
	}
	if (notice.recipientDismissedAt) {
		return { label: "Dismissed by user", variant: "outline" };
	}
	if (!notice.isActive) return null;
	if (notice.requiresAck) {
		return { label: "Needs acknowledgement", variant: "destructive" };
	}
	if (!notice.dismissible) {
		return { label: "Visible until expiry", variant: "outline" };
	}
	return notice.recipientReadAt
		? { label: "Seen, still visible", variant: "default" }
		: { label: "Not seen yet", variant: "default" };
};

const isNoticePendingForRecipient = (notice: UserNotice): boolean => {
	if (!notice.isActive) return false;
	if (notice.requiresAck) return !notice.recipientAcknowledgedAt;
	return notice.dismissible && !notice.recipientDismissedAt;
};

const Fact = ({
	label,
	value,
	href,
}: {
	label: string;
	value: string | number | null | undefined;
	href?: string;
}) => {
	const body = (
		<>
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 break-words text-sm font-medium">
				{value ?? "Not available"}
			</p>
		</>
	);
	const className = cn(
		"rounded-md border bg-muted/20 px-3 py-2",
		href && "block transition hover:border-foreground/30 hover:bg-muted/35",
	);
	if (href) {
		return (
			<Link href={href} className={className}>
				{body}
			</Link>
		);
	}
	return <div className={className}>{body}</div>;
};

const listingTimingLabel = (listing: {
	effectiveStatus: string;
	expiresAt: string;
	updatedAt: string;
}): string => {
	const expiry = formatDateTime(listing.expiresAt);
	const updated = formatDateTime(listing.updatedAt);
	if (listing.effectiveStatus === "expired") {
		return `expired ${expiry} · updated ${updated}`;
	}
	if (listing.effectiveStatus === "active") {
		return `expires ${expiry} · updated ${updated}`;
	}
	return `updated ${updated} · expires ${expiry}`;
};

const canReactivateListing = (listing: {
	status: string;
	effectiveStatus: string;
	expiresAt: string;
}): boolean => {
	const expiresAt = new Date(listing.expiresAt).getTime();
	if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false;
	return (
		listing.effectiveStatus !== "active" &&
		(listing.status === "paused" || listing.status === "removed")
	);
};

const normalizeExpiryForAction = (value: string): string | null => {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
};

const reportUserRoles = (
	report: TicketExchangeAdminReport,
	userId: string | null,
	email: string | null,
): string[] => {
	const roles: string[] = [];
	if (userId && report.reporterUserId === userId) roles.push("Reporter");
	if (
		(userId && report.listing.ownerUserId === userId) ||
		(email &&
			report.listing.ownerEmail.trim().toLowerCase() === email.toLowerCase())
	) {
		roles.push("Listing owner");
	}
	return roles.length > 0 ? roles : ["Connected user"];
};

const userAdminHref = (userId: string | null, email: string | null): string =>
	buildAdminUserHref(userId, email);

const reportPersonLabel = (person: {
	userId?: string | null;
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
}): string => {
	const name = [person.firstName, person.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	const email = person.email?.trim() ?? "";
	if (name && email) return `${name} · ${email}`;
	return name || email || person.userId || "Unknown";
};

const consentSummaryLabel = (input: {
	marketing: boolean | null | undefined;
	eventUpdates: boolean | null | undefined;
}): string => {
	const marketing = Boolean(input.marketing);
	const eventUpdates = Boolean(input.eventUpdates);
	if (marketing && eventUpdates) return "Marketing + event updates";
	if (marketing) return "Marketing";
	if (eventUpdates) return "Event updates only";
	return "No marketing";
};

const audienceBehaviorLabel = (user: {
	searchSignalCount?: number;
	filterSignalCount?: number;
	planActionSignalCount?: number;
	eventActionSignalCount?: number;
	genrePreferenceSignalCount?: number;
}): string => {
	const entries = [
		["Event actions", user.eventActionSignalCount ?? 0],
		["Searches", user.searchSignalCount ?? 0],
		["Filters", user.filterSignalCount ?? 0],
		["Routes", user.planActionSignalCount ?? 0],
		["Genres", user.genrePreferenceSignalCount ?? 0],
	] as const;
	const [label, count] = entries.reduce((best, entry) =>
		entry[1] > best[1] ? entry : best,
	);
	return count > 0 ? label : "No linked activity";
};

export function UserDetailClient({
	lookup,
	initialPayload,
}: UserDetailClientProps) {
	const [payload, setPayload] = useState(initialPayload);
	const [errorMessage, setErrorMessage] = useState(initialPayload.error ?? "");
	const [statusMessage, setStatusMessage] = useState("");
	const [restrictionScope, setRestrictionScope] =
		useState<UserRestrictionScope>("ticket_exchange.post");
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictionNote, setRestrictionNote] = useState("");
	const [restrictionExpiresAt, setRestrictionExpiresAt] = useState("");
	const [noticeSeverity, setNoticeSeverity] =
		useState<UserNoticeSeverity>("warning");
	const [noticeTitle, setNoticeTitle] = useState("");
	const [noticeBody, setNoticeBody] = useState("");
	const [noticeActionError, setNoticeActionError] = useState("");
	const [noticeRequiresAck, setNoticeRequiresAck] = useState(false);
	const [noticeDismissible, setNoticeDismissible] = useState(true);
	const [noticeCtaLabel, setNoticeCtaLabel] = useState("");
	const [noticeCtaHref, setNoticeCtaHref] = useState("");
	const [noticeStartsAt, setNoticeStartsAt] = useState("");
	const [noticeExpiresAt, setNoticeExpiresAt] = useState("");
	const [adminNote, setAdminNote] = useState("");
	const [adminNoteCategory, setAdminNoteCategory] =
		useState<UserAdminNoteCategory>("general");
	const [nextStatus, setNextStatus] = useState<ManagedUserStatus>("active");
	const [statusReason, setStatusReason] = useState("");
	const [bulkListingReason, setBulkListingReason] = useState("");
	const [selectedPlan, setSelectedPlan] = useState<AdminPlanDetail | null>(
		null,
	);
	const [isSavedEventsOpen, setIsSavedEventsOpen] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		setNoticeExpiresAt((current) =>
			current ? current : getDefaultNoticeExpiresAtInputValue(),
		);
	}, []);

	const detail = payload.detail;
	const user = detail?.user ?? null;
	const collectedProfile = detail?.collectedProfile ?? null;
	const collectedUser = detail?.collectedRecord ?? null;
	const userId = user?.userId ?? collectedUser?.userId ?? null;
	const email =
		user?.email ??
		collectedUser?.email ??
		(lookup.includes("@") ? lookup : null);
	const marketingConsent = Boolean(
		user?.marketingConsent || collectedUser?.marketingConsent,
	);
	const eventUpdateConsent = Boolean(
		user?.eventUpdateConsent || collectedUser?.eventUpdateConsent,
	);
	const displayName = useMemo(() => {
		const firstName = user?.firstName ?? collectedUser?.firstName ?? "";
		const lastName = user?.lastName ?? collectedUser?.lastName ?? "";
		return (
			[firstName, lastName].filter(Boolean).join(" ").trim() || email || lookup
		);
	}, [collectedUser, email, lookup, user]);

	useEffect(() => {
		if (user?.status) setNextStatus(user.status);
	}, [user?.status]);

	const activeRestrictions =
		detail?.restrictions.filter((restriction) => restriction.isActive) ?? [];
	const pendingNotices =
		detail?.notices.filter(isNoticePendingForRecipient) ?? [];
	const scheduledNotices =
		detail?.notices.filter((notice) => {
			if (notice.revokedAt) return false;
			const startsAt = new Date(notice.startsAt).getTime();
			return Number.isFinite(startsAt) && startsAt > Date.now();
		}) ?? [];
	const activeListings =
		detail?.ticketListings.filter(
			(listing) => listing.effectiveStatus === "active",
		) ?? [];
	const hasListingActionReason = bulkListingReason.trim().length > 0;
	const hasStatusReason = statusReason.trim().length > 0;
	const hasRestrictionReason = restrictionReason.trim().length > 0;
	const hasAdminNote = adminNote.trim().length > 0;
	const canSendNotice =
		Boolean(userId || email) &&
		noticeTitle.trim().length > 0 &&
		noticeBody.trim().length > 0;
	const ticketReportStats = useMemo(() => {
		const reports = detail?.ticketReports ?? [];
		return reports.reduce(
			(stats, report) => {
				const roles = reportUserRoles(report, userId, email);
				return {
					open: stats.open + (report.reviewedAt ? 0 : 1),
					sent: stats.sent + (roles.includes("Reporter") ? 1 : 0),
					againstListings:
						stats.againstListings + (roles.includes("Listing owner") ? 1 : 0),
				};
			},
			{ open: 0, sent: 0, againstListings: 0 },
		);
	}, [detail?.ticketReports, email, userId]);
	const sortedTicketReports = useMemo(
		() =>
			[...(detail?.ticketReports ?? [])].sort((left, right) => {
				if (!left.reviewedAt && right.reviewedAt) return -1;
				if (left.reviewedAt && !right.reviewedAt) return 1;
				return (
					new Date(right.createdAt).getTime() -
					new Date(left.createdAt).getTime()
				);
			}),
		[detail?.ticketReports],
	);
	const copyValue = async (label: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setStatusMessage(`${label} copied.`);
		} catch {
			setErrorMessage(`Could not copy ${label.toLowerCase()}.`);
		}
	};

	const refresh = () => {
		startTransition(async () => {
			const result = await getAdminUserDetail({ userId, email });
			setPayload(result);
			setErrorMessage(result.error ?? "");
			setStatusMessage(result.success ? "User refreshed." : "");
		});
	};

	const runMutation = (
		mutation: () => Promise<{
			success: boolean;
			error?: string;
			updatedCount?: number;
		}>,
		successMessage: string,
		clear?: () => void,
	) => {
		startTransition(async () => {
			const result = await mutation();
			if (!result.success) {
				setErrorMessage(result.error ?? "User action failed.");
				return;
			}
			clear?.();
			setErrorMessage("");
			setStatusMessage(
				result.updatedCount != null
					? `${successMessage} (${result.updatedCount} updated).`
					: successMessage,
			);
			const next = await getAdminUserDetail({ userId, email });
			setPayload(next);
		});
	};

	const submitStatusChange = () => {
		if (!userId || !hasStatusReason) return;
		if (nextStatus === user?.status) {
			setErrorMessage("Choose a different status before updating.");
			setStatusMessage("");
			return;
		}
		if (
			nextStatus === "deleted" &&
			!window.confirm(
				`Mark ${email ?? userId} as deleted? This is a managed-user status change, not a hard delete. The user may be blocked from account actions until restored.`,
			)
		) {
			return;
		}
		runMutation(
			() =>
				updateManagedUserStatusAsAdmin({
					userId,
					email,
					status: nextStatus,
					reason: statusReason,
				}),
			nextStatus === "deleted"
				? "User marked deleted"
				: `User status changed to ${statusLabel(nextStatus)}`,
			() => setStatusReason(""),
		);
	};

	const setNoticeAcknowledgementRequired = (checked: boolean) => {
		setNoticeRequiresAck(checked);
		setNoticeDismissible(!checked);
	};

	const submitUserNotice = () => {
		const startsAt = normalizeExpiryForAction(noticeStartsAt);
		const expiresAt = normalizeExpiryForAction(noticeExpiresAt);
		const ctaHrefError = getNoticeCtaHrefError(noticeCtaHref);
		const validationError =
			!noticeTitle.trim() || !noticeBody.trim()
				? "Notice title and body are required."
				: (Boolean(noticeCtaLabel.trim()) && !noticeCtaHref.trim()) ||
						(!noticeCtaLabel.trim() && Boolean(noticeCtaHref.trim()))
					? "CTA label and link must be provided together."
					: (ctaHrefError ??
						getNoticeLifecycleError({
							requiresAck: noticeRequiresAck,
							dismissible: noticeRequiresAck ? false : noticeDismissible,
							startsAt,
							expiresAt,
						}));

		setErrorMessage("");
		setStatusMessage("");
		setNoticeActionError(validationError ?? "");
		if (validationError) return;

		startTransition(async () => {
			const result = await createUserNoticeAsAdmin({
				targetType: userId ? "user" : "email",
				targetUserId: userId,
				targetEmail: email,
				title: noticeTitle,
				body: noticeBody,
				severity: noticeSeverity,
				ctaLabel: noticeCtaLabel,
				ctaHref: normalizeNoticeCtaHref(noticeCtaHref),
				requiresAck: noticeRequiresAck,
				dismissible: noticeRequiresAck ? false : noticeDismissible,
				startsAt,
				expiresAt,
			});
			if (!result.success) {
				setNoticeActionError(result.error ?? "Unable to create notice.");
				return;
			}
			setNoticeActionError("");
			setNoticeTitle("");
			setNoticeBody("");
			setNoticeCtaLabel("");
			setNoticeCtaHref("");
			setNoticeStartsAt("");
			setNoticeExpiresAt(getDefaultNoticeExpiresAtInputValue());
			setNoticeRequiresAck(false);
			setNoticeDismissible(true);
			setErrorMessage("");
			setStatusMessage("Notice sent");
			const next = await getAdminUserDetail({ userId, email });
			setPayload(next);
		});
	};

	if (!payload.success || !detail) {
		return (
			<Card className="ooo-admin-card">
				<CardHeader>
					<CardTitle>User not found</CardTitle>
					<CardDescription>
						{errorMessage || "This user could not be loaded."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Link href={withAdminBasePath("/admin/users")}>
						<Button variant="outline">Back to users</Button>
					</Link>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			<Card className="ooo-admin-card min-w-0 overflow-hidden">
				<CardHeader className="border-b">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div className="flex flex-wrap items-center gap-2">
								<CardTitle>{displayName}</CardTitle>
								{user ? (
									<Badge variant={statusVariant(user.status)}>
										{statusLabel(user.status)}
									</Badge>
								) : (
									<Badge variant="outline">Audience-only row</Badge>
								)}
								{activeRestrictions.length > 0 ? (
									<Badge variant="destructive">
										<ShieldAlert />
										{activeRestrictions.length} active restriction
										{activeRestrictions.length === 1 ? "" : "s"}
									</Badge>
								) : null}
							</div>
							<CardDescription>
								{email ?? "No email"} · {userId ?? "No canonical user id"}
							</CardDescription>
						</div>
						<div className="flex flex-wrap gap-2">
							<Link href={withAdminBasePath("/admin/users")}>
								<Button variant="outline" size="sm">
									Back to Users
								</Button>
							</Link>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={refresh}
								disabled={isPending}
							>
								<RefreshCw />
								Refresh
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-5">
					<Fact
						label="Last Seen"
						value={formatDateTime(
							user?.lastSeenAt ?? collectedUser?.lastSeenAt ?? null,
						)}
					/>
					<Fact
						label="Behavior Profile"
						value={collectedProfile?.user.linkedSignalCount ?? 0}
						href="#audience-activity"
					/>
					<Fact
						label="Listings"
						value={detail.ticketListings.length}
						href="#ticket-exchange"
					/>
					<Fact
						label="Submissions"
						value={detail.eventSubmissions.length}
						href="#submissions-plans"
					/>
					<Fact
						label="Routes"
						value={detail.plans.length}
						href="#submissions-plans"
					/>
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

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-6">
					<section id="identity" className="scroll-mt-44">
						<Card className="ooo-admin-card min-w-0 overflow-hidden">
							<CardHeader className="border-b">
								<CardTitle>Identity & Activity</CardTitle>
								<CardDescription>
									Canonical identity, consent context, and current linked usage.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
								<Fact label="Email" value={email} />
								<Fact label="User ID" value={userId} />
								<Fact
									label="Source"
									value={user?.source ?? collectedUser?.source}
								/>
								<Fact
									label="First Seen"
									value={formatDateTime(
										user?.firstSeenAt ?? collectedUser?.firstSignInAt ?? null,
									)}
								/>
								<Fact
									label="Email Consent"
									value={consentSummaryLabel({
										marketing: marketingConsent,
										eventUpdates: eventUpdateConsent,
									})}
								/>
								<Fact
									label="Saved Events"
									value={detail.savedEventKeys.length}
									href="#submissions-plans"
								/>
								<Fact label="Pending Notices" value={pendingNotices.length} />
								<Fact
									label="Scheduled Notices"
									value={scheduledNotices.length}
								/>
								<Fact label="Admin Notes" value={detail.adminNotes.length} />
							</CardContent>
						</Card>
					</section>

					<section id="audience-activity" className="scroll-mt-44">
						<Card className="ooo-admin-card min-w-0 overflow-hidden">
							<CardHeader className="border-b">
								<CardTitle>Behavior Profile</CardTitle>
								<CardDescription>
									Recent searches, filters, plans, events, genres, and device
									context linked to this user.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-4">
								{collectedProfile ? (
									<>
										<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
											<Fact
												label="Behavior Type"
												value={audienceBehaviorLabel(collectedProfile.user)}
											/>
											<Fact
												label="Linked Activity"
												value={collectedProfile.user.linkedSignalCount ?? 0}
											/>
											<Fact
												label="Latest Activity"
												value={
													collectedProfile.user.lastSignalAt
														? formatDateTime(collectedProfile.user.lastSignalAt)
														: "No linked activity"
												}
											/>
											<Fact
												label="Top Genre"
												value={
													formatAudienceContextValue(
														collectedProfile.genrePreferences[0]?.genre,
													) ?? "Unknown"
												}
											/>
											<Fact
												label="Device Context"
												value={
													[
														collectedProfile.user.deviceClass,
														collectedProfile.user.platform,
														collectedProfile.user.browserFamily,
													]
														.map(formatAudienceContextValue)
														.filter(Boolean)
														.join(" · ") || "Unknown"
												}
											/>
										</div>
										<div className="grid gap-3 xl:grid-cols-2">
											<div className="rounded-lg border bg-background/70 p-3">
												<p className="text-sm font-semibold">Recent Searches</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{RECENT_LIST_HELP_TEXT.searches}
												</p>
												<div className="mt-2 space-y-1.5">
													{collectedProfile.recentSearches.length > 0 ? (
														collectedProfile.recentSearches.map((item) => (
															<p
																key={`${item.query}-${item.recordedAt}`}
																className="flex justify-between gap-2 text-xs"
															>
																<span className="truncate">
																	{(() => {
																		const searchHref = buildAudienceSearchHref(
																			item.query,
																		);
																		return searchHref == null ? (
																			item.query
																		) : (
																			<Link
																				href={searchHref}
																				target="_blank"
																				rel="noreferrer"
																				className="inline-flex items-center underline decoration-dotted underline-offset-2 hover:decoration-solid"
																			>
																				{item.query}
																			</Link>
																		);
																	})()}
																</span>
																<span className="shrink-0 text-muted-foreground">
																	{formatDateTime(item.recordedAt)}
																</span>
															</p>
														))
													) : (
														<p className="text-xs text-muted-foreground">
															No searches linked.
														</p>
													)}
												</div>
											</div>
											<div className="rounded-lg border bg-background/70 p-3">
												<p className="text-sm font-semibold">Recent Filters</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{RECENT_LIST_HELP_TEXT.filters}
												</p>
												<div className="mt-2 space-y-1.5">
													{collectedProfile.recentFilters.length > 0 ? (
														collectedProfile.recentFilters.map((item) => {
															const filterHref = buildAudienceFilterHref(
																item.filterGroup,
																item.filterValue,
															);
															const groupLabel = getAudienceFilterGroupLabel(
																item.filterGroup,
															);
															const valueLabel = getAudienceFilterDisplayValue(
																item.filterGroup,
																item.filterValue,
															);
															return (
																<p
																	key={`${item.filterGroup}-${item.filterValue}-${item.recordedAt}`}
																	className="flex justify-between gap-2 text-xs"
																>
																	<span
																		className="min-w-0 flex-1 whitespace-normal break-words"
																		title={`${groupLabel}: ${valueLabel}`}
																	>
																		{groupLabel}:{" "}
																		{filterHref == null ? (
																			valueLabel
																		) : (
																			<Link
																				href={filterHref}
																				target="_blank"
																				rel="noreferrer"
																				className="inline-flex items-center underline decoration-dotted underline-offset-2 hover:decoration-solid"
																			>
																				{valueLabel}
																			</Link>
																		)}
																	</span>
																	<span className="shrink-0 text-muted-foreground">
																		{formatDateTime(item.recordedAt)}
																	</span>
																</p>
															);
														})
													) : (
														<p className="text-xs text-muted-foreground">
															No filters linked.
														</p>
													)}
												</div>
											</div>
											<div className="rounded-lg border bg-background/70 p-3">
												<p className="text-sm font-semibold">
													Genre Preferences
												</p>
												<div className="mt-2 space-y-1.5">
													{collectedProfile.genrePreferences.length > 0 ? (
														collectedProfile.genrePreferences.map((item) => (
															<p
																key={item.genre}
																className="flex justify-between gap-2 text-xs"
															>
																<span className="truncate">
																	{formatAudienceContextValue(item.genre)}
																</span>
																<span className="shrink-0 tabular-nums text-muted-foreground">
																	score {item.score}
																</span>
															</p>
														))
													) : (
														<p className="text-xs text-muted-foreground">
															No genre activity.
														</p>
													)}
												</div>
											</div>
											<div className="rounded-lg border bg-background/70 p-3">
												<p className="text-sm font-semibold">
													Recent Plan Actions
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{RECENT_LIST_HELP_TEXT.planActions}
												</p>
												<div className="mt-2 space-y-1.5">
													{collectedProfile.recentPlanActions.length > 0 ? (
														collectedProfile.recentPlanActions.map((item) => (
															<p
																key={`${item.surface}-${item.action}-${item.recordedAt}`}
																className="flex justify-between gap-2 text-xs"
															>
																<span className="min-w-0 flex-1 truncate">
																	{formatAudienceContextValue(item.surface)} ·{" "}
																	{formatAudienceContextValue(item.action)}
																	{item.detail ? (
																		<span className="text-muted-foreground">
																			{" "}
																			({item.detail})
																		</span>
																	) : null}
																</span>
																<span className="shrink-0 text-muted-foreground">
																	{formatDateTime(item.recordedAt)}
																</span>
															</p>
														))
													) : (
														<p className="text-xs text-muted-foreground">
															No plan actions linked.
														</p>
													)}
												</div>
											</div>
											<div className="rounded-lg border bg-background/70 p-3">
												<p className="text-sm font-semibold">
													Recent Event Actions
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{RECENT_LIST_HELP_TEXT.eventActions}
												</p>
												<div className="mt-2 space-y-1.5">
													{collectedProfile.recentEventActions.length > 0 ? (
														collectedProfile.recentEventActions
															.slice(0, 8)
															.map((item) => (
																<p
																	key={`${item.eventKey}-${item.actionType}-${item.recordedAt}`}
																	className="flex justify-between gap-2 text-xs"
																>
																	<span className="min-w-0 flex-1 truncate">
																		{formatAudienceContextValue(
																			item.actionType,
																		)}{" "}
																		·{" "}
																		{item.eventHref ? (
																			<Link
																				href={item.eventHref}
																				target="_blank"
																				rel="noreferrer"
																				className="underline-offset-4 hover:underline"
																			>
																				{item.eventName ?? item.eventKey}
																			</Link>
																		) : (
																			(item.eventName ?? item.eventKey)
																		)}
																	</span>
																	<span className="shrink-0 text-muted-foreground">
																		{formatDateTime(item.recordedAt)}
																	</span>
																</p>
															))
													) : (
														<p className="text-xs text-muted-foreground">
															No event actions linked.
														</p>
													)}
												</div>
											</div>
										</div>
									</>
								) : (
									<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
										No audience activity profile is linked to this user yet.
									</div>
								)}
							</CardContent>
						</Card>
					</section>

					<section id="ticket-exchange" className="scroll-mt-44">
						<Card className="ooo-admin-card min-w-0 overflow-hidden">
							<CardHeader className="border-b">
								<CardTitle>Ticket Exchange</CardTitle>
								<CardDescription>
									Current and historical listings plus reports connected to this
									person.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-4">
								<div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
									<div>
										<p className="text-sm font-medium">
											{activeListings.length} active listing
											{activeListings.length === 1 ? "" : "s"}
										</p>
										<p className="text-xs text-muted-foreground">
											Enter a reason to unlock listing actions. Bulk actions
											affect active listings only.
										</p>
									</div>
									<Input
										value={bulkListingReason}
										onChange={(event) =>
											setBulkListingReason(event.target.value)
										}
										placeholder="Reason required for listing actions"
										className="sm:min-w-64"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={
											isPending ||
											activeListings.length === 0 ||
											!hasListingActionReason
										}
										onClick={() =>
											runMutation(
												() =>
													bulkUpdateUserTicketListingsAsAdmin({
														userId,
														email,
														status: "paused",
														reason: bulkListingReason,
													}),
												"Active listings paused",
												() => setBulkListingReason(""),
											)
										}
									>
										<Pause />
										Pause All
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										disabled={
											isPending ||
											activeListings.length === 0 ||
											!hasListingActionReason
										}
										onClick={() =>
											runMutation(
												() =>
													bulkUpdateUserTicketListingsAsAdmin({
														userId,
														email,
														status: "removed",
														reason: bulkListingReason,
													}),
												"Active listings removed",
												() => setBulkListingReason(""),
											)
										}
									>
										<Trash2 />
										Remove All
									</Button>
								</div>

								{detail.ticketListings.length > 0 ? (
									detail.ticketListings.map((listing) => {
										const canReactivate = canReactivateListing(listing);
										return (
											<div
												key={listing.id}
												className="rounded-lg border bg-background/70 p-3"
											>
												<div className="flex flex-wrap items-center gap-2">
													<Badge variant="outline">{listing.listingType}</Badge>
													<Badge
														variant={
															listing.effectiveStatus === "active"
																? "default"
																: listing.effectiveStatus === "removed"
																	? "destructive"
																	: "outline"
														}
													>
														{listing.effectiveStatus === "active"
															? "Live listing"
															: listing.effectiveStatus}
													</Badge>
													{listing.reportCount > 0 ? (
														<Badge variant="destructive">
															{listing.reportCount} report
															{listing.reportCount === 1 ? "" : "s"}
														</Badge>
													) : null}
												</div>
												<p className="mt-2 font-medium">{listing.eventName}</p>
												<p className="mt-1 text-sm text-muted-foreground">
													{listing.quantityLabel || "Quantity missing"} ·{" "}
													{listing.priceLabel || "No price"} ·{" "}
													{listingTimingLabel(listing)}
												</p>
												<div className="mt-3 flex flex-wrap gap-2">
													<Link
														href={withAdminBasePath(
															`/event/${encodeURIComponent(listing.eventKey)}/${encodeURIComponent(listing.eventSlug)}`,
														)}
													>
														<Button type="button" variant="outline" size="sm">
															<ExternalLink />
															Event
														</Button>
													</Link>
													<Link
														href={withAdminBasePath(
															`/exchange/${encodeURIComponent(listing.eventKey)}`,
														)}
													>
														<Button type="button" variant="outline" size="sm">
															<ExternalLink />
															Exchange
														</Button>
													</Link>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() =>
															void copyValue("Listing ID", listing.id)
														}
													>
														<Copy />
														Copy ID
													</Button>
													{canReactivate ? (
														<Button
															type="button"
															variant="outline"
															size="sm"
															disabled={isPending || !hasListingActionReason}
															onClick={() =>
																runMutation(
																	() =>
																		updateUserTicketListingAsAdmin({
																			userId,
																			email,
																			listingId: listing.id,
																			status: "active",
																			reason: bulkListingReason,
																		}),
																	"Listing reactivated",
																)
															}
														>
															Reactivate
														</Button>
													) : (
														listing.effectiveStatus === "active" && (
															<>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	disabled={
																		isPending || !hasListingActionReason
																	}
																	onClick={() =>
																		runMutation(
																			() =>
																				updateUserTicketListingAsAdmin({
																					userId,
																					email,
																					listingId: listing.id,
																					status: "paused",
																					reason: bulkListingReason,
																				}),
																			"Listing paused",
																		)
																	}
																>
																	Pause
																</Button>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	disabled={
																		isPending || !hasListingActionReason
																	}
																	onClick={() =>
																		runMutation(
																			() =>
																				updateUserTicketListingAsAdmin({
																					userId,
																					email,
																					listingId: listing.id,
																					status: "resolved",
																					reason: bulkListingReason,
																				}),
																			"Listing resolved",
																		)
																	}
																>
																	Resolve
																</Button>
																<Button
																	type="button"
																	variant="destructive"
																	size="sm"
																	disabled={
																		isPending || !hasListingActionReason
																	}
																	onClick={() =>
																		runMutation(
																			() =>
																				updateUserTicketListingAsAdmin({
																					userId,
																					email,
																					listingId: listing.id,
																					status: "removed",
																					reason: bulkListingReason,
																				}),
																			"Listing removed",
																		)
																	}
																>
																	Remove
																</Button>
															</>
														)
													)}
												</div>
											</div>
										);
									})
								) : (
									<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
										No ticket listings.
									</div>
								)}

								{detail.ticketReports.length > 0 ? (
									<div className="space-y-2">
										<div>
											<p className="text-sm font-semibold">
												Reports involving this user
											</p>
											<p className="text-xs text-muted-foreground">
												Open reports match the moderation queue. Reporter means
												they made the report; listing owner means the report is
												against their listing.
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{ticketReportStats.open} open · {ticketReportStats.sent}{" "}
												sent · {ticketReportStats.againstListings} against their
												listings
											</p>
										</div>
										{sortedTicketReports.map((report) => {
											const roles = reportUserRoles(report, userId, email);
											const reporterHref = report.reporterUserId
												? userAdminHref(report.reporterUserId, null)
												: null;
											const reporterLabel = reportPersonLabel(report.reporter);
											const ownerLabel = reportPersonLabel(
												report.listing.owner,
											);
											const ownerHref =
												report.listing.ownerUserId || report.listing.ownerEmail
													? userAdminHref(
															report.listing.ownerUserId || null,
															report.listing.ownerEmail || null,
														)
													: null;
											const eventHref = report.listing.eventKey
												? withAdminBasePath(
														`/event/${encodeURIComponent(report.listing.eventKey)}${
															report.listing.eventSlug
																? `/${encodeURIComponent(report.listing.eventSlug)}`
																: ""
														}`,
													)
												: null;
											const exchangeHref = report.listing.eventKey
												? withAdminBasePath(
														`/exchange/${encodeURIComponent(report.listing.eventKey)}`,
													)
												: null;
											return (
												<div
													key={report.id}
													className={cn(
														"rounded-lg border p-3 text-sm",
														report.reviewedAt
															? "bg-background/70"
															: "border-amber-300/40 bg-amber-50/25 dark:border-amber-900/50 dark:bg-amber-950/15",
													)}
												>
													<div className="flex flex-wrap gap-2">
														<Badge
															variant={
																report.reviewedAt ? "outline" : "destructive"
															}
														>
															{report.reviewedAt ? "Reviewed" : "Open report"}
														</Badge>
														<Badge variant="outline">
															{getTicketExchangeReportReasonLabel(
																report.reason,
															)}
														</Badge>
														{roles.map((role) => (
															<Badge key={role} variant="outline">
																{role}
															</Badge>
														))}
													</div>
													<p className="mt-2 font-medium">
														{report.listing.eventName}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														{report.listing.listingType === "selling"
															? "Selling"
															: "Looking"}{" "}
														·{" "}
														{report.listing.quantityLabel || "Quantity missing"}
														{report.listing.priceLabel
															? ` · ${report.listing.priceLabel}`
															: ""}{" "}
														· reported {formatDateTime(report.createdAt)}
														{report.reviewedAt
															? ` · reviewed ${formatDateTime(report.reviewedAt)}`
															: ""}
													</p>
													<div className="mt-3 grid gap-2 sm:grid-cols-2">
														<div className="rounded-md border bg-background/70 px-3 py-2 text-xs">
															<p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
																Listing owner
															</p>
															<p className="mt-1">
																{ownerHref ? (
																	<Link
																		href={ownerHref}
																		className="font-medium text-foreground underline-offset-2 hover:underline"
																	>
																		{ownerLabel}
																	</Link>
																) : (
																	ownerLabel
																)}
															</p>
														</div>
														<div className="rounded-md border bg-background/70 px-3 py-2 text-xs">
															<p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
																Reporter
															</p>
															<p className="mt-1">
																{reporterHref ? (
																	<Link
																		href={reporterHref}
																		className="font-medium text-foreground underline-offset-2 hover:underline"
																	>
																		{reporterLabel}
																	</Link>
																) : (
																	reporterLabel
																)}
															</p>
														</div>
													</div>
													<div className="mt-3 rounded-md border border-amber-300/50 bg-background/70 px-3 py-2">
														<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-100/80">
															Report message
														</p>
														<p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
															{report.details ||
																"No extra message from the reporter."}
														</p>
													</div>
													<div className="mt-3 flex flex-wrap gap-2">
														{!report.reviewedAt ? (
															<Link
																href={withAdminBasePath(
																	`/admin/content#ticket-report-${encodeURIComponent(report.id)}`,
																)}
															>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																>
																	<ExternalLink />
																	Open report
																</Button>
															</Link>
														) : null}
														{eventHref ? (
															<Link href={eventHref}>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																>
																	<ExternalLink />
																	Event
																</Button>
															</Link>
														) : null}
														{exchangeHref ? (
															<Link href={exchangeHref}>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																>
																	<ExternalLink />
																	Exchange
																</Button>
															</Link>
														) : null}
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() =>
																void copyValue("Report ID", report.id)
															}
														>
															<Copy />
															Copy report
														</Button>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() =>
																void copyValue("Listing ID", report.listingId)
															}
														>
															<Copy />
															Copy listing
														</Button>
													</div>
												</div>
											);
										})}
									</div>
								) : null}
							</CardContent>
						</Card>
					</section>

					<section id="submissions-plans" className="scroll-mt-44">
						<div className="grid gap-6 xl:grid-cols-2">
							<Card className="ooo-admin-card min-w-0 overflow-hidden">
								<CardHeader className="border-b">
									<CardTitle>Submissions</CardTitle>
									<CardDescription>
										Event submissions, update requests, and price flags.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3 pt-4">
									{detail.eventSubmissions.length > 0 ? (
										detail.eventSubmissions.map((submission) => (
											<div
												key={submission.id}
												className="rounded-lg border bg-background/70 p-3"
											>
												<div className="flex flex-wrap gap-2">
													<Badge
														variant={
															submission.status === "declined"
																? "destructive"
																: "outline"
														}
													>
														{submission.status}
													</Badge>
													<Badge variant="outline">
														{submission.payload.submissionType ?? "new_event"}
													</Badge>
												</div>
												<p className="mt-2 text-sm font-medium">
													{submission.payload.eventName}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{formatDateTime(submission.createdAt)}
												</p>
												<div className="mt-3 flex flex-wrap gap-2">
													<Link
														href={withAdminBasePath(
															`/admin/content#submission-${encodeURIComponent(submission.id)}`,
														)}
													>
														<Button type="button" variant="outline" size="sm">
															<ExternalLink />
															Open submission
														</Button>
													</Link>
													{submission.acceptedEventKey ? (
														<Link
															href={withAdminBasePath(
																`/event/${encodeURIComponent(submission.acceptedEventKey)}`,
															)}
														>
															<Button type="button" variant="outline" size="sm">
																<ExternalLink />
																Accepted event
															</Button>
														</Link>
													) : null}
												</div>
											</div>
										))
									) : (
										<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
											No submissions.
										</div>
									)}
								</CardContent>
							</Card>

							<Card className="ooo-admin-card min-w-0 overflow-hidden">
								<CardHeader className="border-b">
									<CardTitle>Routes & Saved Events</CardTitle>
									<CardDescription>
										Metadata only for private route records.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3 pt-4">
									{detail.plans.length > 0 ? (
										detail.plans.map((plan) => (
											<div
												key={plan.id}
												className="rounded-lg border bg-background/70 p-3"
											>
												<div className="flex flex-wrap gap-2">
													<Badge variant="outline">{plan.visibility}</Badge>
													<Badge variant="outline">
														{plan.stops.length} stops
													</Badge>
												</div>
												<p className="mt-2 text-sm font-medium">{plan.title}</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{plan.planDate} · updated{" "}
													{formatDateTime(plan.updatedAt)}
												</p>
												<div className="mt-3 flex flex-wrap gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => setSelectedPlan(plan)}
													>
														<Eye />
														View contents
													</Button>
													{plan.publicSharePath ? (
														<Link
															href={withAdminBasePath(plan.publicSharePath)}
														>
															<Button type="button" variant="outline" size="sm">
																<ExternalLink />
																Public plan
															</Button>
														</Link>
													) : null}
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => void copyValue("Plan ID", plan.id)}
													>
														<Copy />
														Copy ID
													</Button>
												</div>
											</div>
										))
									) : (
										<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
											No synced routes.
										</div>
									)}
									<div className="rounded-lg border bg-muted/20 p-3 text-sm">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<p className="font-medium">
												{detail.savedEventKeys.length} saved event
												{detail.savedEventKeys.length === 1 ? "" : "s"}
											</p>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={detail.savedEvents.length === 0}
												onClick={() => setIsSavedEventsOpen(true)}
											>
												<Eye />
												View saved events
											</Button>
										</div>
										<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
											{detail.savedEvents
												.slice(0, 4)
												.map((saved) => saved.event.name)
												.join(", ") || "No saved event keys"}
										</p>
									</div>
								</CardContent>
							</Card>
						</div>
					</section>

					<section id="audit" className="scroll-mt-44">
						<Card className="ooo-admin-card min-w-0 overflow-hidden">
							<CardHeader className="border-b">
								<CardTitle>Admin Audit</CardTitle>
								<CardDescription>
									Recent admin actions recorded against this user.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 pt-4">
								{detail.activityEvents.length > 0 ? (
									detail.activityEvents.map((event) => (
										<div
											key={event.id}
											className="rounded-lg border bg-background/70 p-3"
										>
											<div className="flex flex-wrap gap-2">
												<Badge variant="outline">{event.category}</Badge>
												<Badge
													variant={
														event.severity === "destructive"
															? "destructive"
															: "outline"
													}
												>
													{event.action}
												</Badge>
											</div>
											<p className="mt-2 text-sm font-medium">
												{event.summary}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{event.actorLabel} · {formatDateTime(event.occurredAt)}
											</p>
										</div>
									))
								) : (
									<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
										No admin audit events for this user yet.
									</div>
								)}
							</CardContent>
						</Card>
					</section>
				</div>

				<aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
					<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
						<CardHeader className="border-b">
							<CardTitle>User Actions</CardTitle>
							<CardDescription>
								Granular restrictions and person-level operations.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 pt-4">
							<div className="space-y-2 rounded-lg border p-3">
								<p className="text-sm font-semibold">Status</p>
								<p className="text-xs text-muted-foreground">
									Change the managed account state. Deleted is a soft status,
									not a hard data erase.
								</p>
								<select
									value={nextStatus}
									onChange={(event) =>
										setNextStatus(event.target.value as ManagedUserStatus)
									}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{STATUS_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								<Input
									value={statusReason}
									onChange={(event) => setStatusReason(event.target.value)}
									placeholder={
										nextStatus === "deleted"
											? "Reason for marking deleted"
											: "Reason required"
									}
								/>
								<Button
									type="button"
									variant={nextStatus === "deleted" ? "destructive" : "outline"}
									size="sm"
									disabled={
										isPending ||
										!userId ||
										!hasStatusReason ||
										nextStatus === user?.status
									}
									onClick={submitStatusChange}
								>
									<UserRound />
									{nextStatus === "deleted"
										? "Mark User Deleted"
										: "Update Status"}
								</Button>
							</div>

							<div className="space-y-2 rounded-lg border p-3">
								<p className="text-sm font-semibold">Add Restriction</p>
								<select
									value={restrictionScope}
									onChange={(event) =>
										setRestrictionScope(
											event.target.value as UserRestrictionScope,
										)
									}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{USER_RESTRICTION_SCOPES.map((scope) => (
										<option key={scope} value={scope}>
											{RESTRICTION_LABELS[scope]}
										</option>
									))}
								</select>
								<Input
									value={restrictionReason}
									onChange={(event) => setRestrictionReason(event.target.value)}
									placeholder="User-facing reason"
								/>
								<Textarea
									value={restrictionNote}
									onChange={(event) => setRestrictionNote(event.target.value)}
									placeholder="Internal note"
									rows={3}
								/>
								<div className="space-y-1.5">
									<Label htmlFor="restriction-expires">Expires At</Label>
									<Input
										id="restriction-expires"
										type="datetime-local"
										value={restrictionExpiresAt}
										onChange={(event) =>
											setRestrictionExpiresAt(event.target.value)
										}
									/>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || !hasRestrictionReason}
									onClick={() =>
										runMutation(
											() =>
												createUserRestrictionAsAdmin({
													userId,
													email,
													scope: restrictionScope,
													reason: restrictionReason,
													internalNote: restrictionNote,
													expiresAt:
														normalizeExpiryForAction(restrictionExpiresAt),
												}),
											"Restriction added",
											() => {
												setRestrictionReason("");
												setRestrictionNote("");
												setRestrictionExpiresAt("");
											},
										)
									}
								>
									<Ban />
									Add Restriction
								</Button>
							</div>

							<div className="space-y-2 rounded-lg border p-3">
								<p className="text-sm font-semibold">Send Notice</p>
								<select
									value={noticeSeverity}
									onChange={(event) =>
										setNoticeSeverity(event.target.value as UserNoticeSeverity)
									}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{USER_NOTICE_SEVERITIES.map((severity) => (
										<option key={severity} value={severity}>
											{noticeSeverityLabel(severity)}
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
									rows={3}
								/>
								<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
								<div className="grid gap-2">
									<label className="flex items-center gap-2 text-sm">
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
											"flex items-center gap-2 text-sm",
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
									<Label htmlFor="user-notice-starts">Starts At</Label>
									<Input
										id="user-notice-starts"
										type="datetime-local"
										value={noticeStartsAt}
										onChange={(event) => setNoticeStartsAt(event.target.value)}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="user-notice-expires">Expires At</Label>
									<Input
										id="user-notice-expires"
										type="datetime-local"
										value={noticeExpiresAt}
										onChange={(event) => setNoticeExpiresAt(event.target.value)}
									/>
									<p className="text-xs text-muted-foreground">
										Defaults to 14 days. Clear only when the notice should
										remain until dismissed, acknowledged, or revoked.
									</p>
								</div>
								{noticeActionError ? (
									<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										{noticeActionError}
									</div>
								) : null}
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || !canSendNotice}
									onClick={submitUserNotice}
								>
									<Bell />
									{isPending ? "Sending..." : "Send Notice"}
								</Button>
							</div>

							<div className="space-y-2 rounded-lg border p-3">
								<p className="text-sm font-semibold">Internal Note</p>
								<select
									value={adminNoteCategory}
									onChange={(event) =>
										setAdminNoteCategory(
											event.target.value as UserAdminNoteCategory,
										)
									}
									className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm"
								>
									{USER_ADMIN_NOTE_CATEGORIES.map((category) => (
										<option key={category} value={category}>
											{ADMIN_NOTE_LABELS[category]}
										</option>
									))}
								</select>
								<Textarea
									value={adminNote}
									onChange={(event) => setAdminNote(event.target.value)}
									placeholder="Private admin note"
									rows={3}
								/>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isPending || !hasAdminNote}
									onClick={() =>
										runMutation(
											() =>
												addUserAdminNoteAsAdmin({
													userId,
													email,
													category: adminNoteCategory,
													note: adminNote,
												}),
											"Admin note added",
											() => setAdminNote(""),
										)
									}
								>
									<MessageSquare />
									Add Note
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
						<CardHeader className="border-b">
							<CardTitle>Policy Records</CardTitle>
							<CardDescription>
								Active records can be revoked. Historical records are read-only.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 pt-4">
							<div className="space-y-2">
								<p className="text-sm font-semibold">Restrictions</p>
								{detail.restrictions.length > 0 ? (
									detail.restrictions.map((restriction) => (
										<div
											key={restriction.id}
											className="rounded-lg border bg-background/70 p-3"
										>
											<div className="flex flex-wrap gap-2">
												<Badge
													variant={
														restriction.isActive ? "destructive" : "outline"
													}
												>
													{RESTRICTION_LABELS[restriction.scope]}
												</Badge>
											</div>
											<p className="mt-2 text-sm text-muted-foreground">
												{restriction.reason}
											</p>
											{restriction.isActive ? (
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="mt-3"
													disabled={isPending}
													onClick={() =>
														runMutation(
															() =>
																revokeUserRestrictionAsAdmin({
																	restrictionId: restriction.id,
																	userId,
																	email,
																}),
															"Restriction revoked",
														)
													}
												>
													<Check />
													Revoke
												</Button>
											) : null}
										</div>
									))
								) : (
									<p className="rounded-lg border bg-muted/25 p-3 text-sm text-muted-foreground">
										No restrictions.
									</p>
								)}
							</div>

							<div className="space-y-2">
								<p className="text-sm font-semibold">Notices</p>
								{detail.notices.length > 0 ? (
									detail.notices.map((notice) => {
										const status = noticeStatus(notice);
										const recipientStatus = noticeRecipientStatus(notice);
										const showLifecycleBadge =
											shouldShowNoticeLifecycleBadge(status);
										const canRevokeNotice = canRevokeNoticeStatus(status);
										return (
											<div
												key={notice.id}
												className="rounded-lg border bg-background/70 p-3"
											>
												<div className="flex flex-wrap gap-2">
													{recipientStatus ? (
														<Badge variant={recipientStatus.variant}>
															{recipientStatus.label}
														</Badge>
													) : null}
													{showLifecycleBadge ? (
														<Badge variant={status.variant}>
															{status.label}
														</Badge>
													) : null}
													<Badge variant={noticeVariant(notice.severity)}>
														{noticeSeverityLabel(notice.severity)}
													</Badge>
												</div>
												<p className="mt-2 text-sm font-medium">
													{notice.title}
												</p>
												<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
													{notice.body}
												</p>
												<p className="mt-2 text-xs text-muted-foreground">
													{noticeTargetLabel(
														notice.targetType,
														notice.segmentKey,
													)}
													{showLifecycleBadge
														? ` · ${status.label.toLowerCase()}`
														: ""}{" "}
													· starts {formatDateTime(notice.startsAt)}
													{notice.expiresAt
														? ` · expires ${formatDateTime(notice.expiresAt)}`
														: ""}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Delivered {notice.deliveredCount ?? 0} · read{" "}
													{notice.readCount ?? 0} · acknowledged{" "}
													{notice.acknowledgedCount ?? 0} · dismissed{" "}
													{notice.dismissedCount ?? 0}
												</p>
												{notice.recipientReadAt ||
												notice.recipientAcknowledgedAt ||
												notice.recipientDismissedAt ? (
													<p className="mt-1 text-xs text-muted-foreground">
														This user:{" "}
														{notice.recipientAcknowledgedAt
															? `acknowledged ${formatDateTime(notice.recipientAcknowledgedAt)}`
															: notice.recipientDismissedAt
																? `dismissed ${formatDateTime(notice.recipientDismissedAt)}`
																: notice.recipientReadAt
																	? `read ${formatDateTime(notice.recipientReadAt)}`
																	: "not seen"}
													</p>
												) : null}
												{canRevokeNotice ? (
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="mt-3"
														disabled={isPending}
														onClick={() =>
															runMutation(
																() =>
																	revokeUserNoticeAsAdmin({
																		noticeId: notice.id,
																		userId,
																		email,
																	}),
																"Notice revoked",
															)
														}
													>
														<Ban />
														Revoke
													</Button>
												) : null}
											</div>
										);
									})
								) : (
									<p className="rounded-lg border bg-muted/25 p-3 text-sm text-muted-foreground">
										No notices.
									</p>
								)}
							</div>
						</CardContent>
					</Card>

					<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
						<CardHeader className="border-b">
							<CardTitle>Admin Notes</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 pt-4">
							{detail.adminNotes.length > 0 ? (
								detail.adminNotes.map((note) => (
									<div key={note.id} className="rounded-lg border p-3">
										<Badge variant="outline">
											{ADMIN_NOTE_LABELS[note.category]}
										</Badge>
										<p className="mt-2 text-sm">{note.note}</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{note.createdBy} · {formatDateTime(note.createdAt)}
										</p>
									</div>
								))
							) : (
								<p className="rounded-lg border bg-muted/25 p-3 text-sm text-muted-foreground">
									No internal notes.
								</p>
							)}
						</CardContent>
					</Card>
				</aside>
			</div>

			<Dialog
				open={Boolean(selectedPlan)}
				onOpenChange={(open) => {
					if (!open) setSelectedPlan(null);
				}}
			>
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>{selectedPlan?.title ?? "Route"}</DialogTitle>
						<DialogDescription>
							{selectedPlan
								? `${selectedPlan.planDate} · ${selectedPlan.resolvedStops.length} stops`
								: "Route contents"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						{selectedPlan?.resolvedStops.length ? (
							selectedPlan.resolvedStops.map((stop) => (
								<div
									key={stop.id}
									className="rounded-lg border bg-background/70 p-3"
								>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant="outline">Stop {stop.stopOrder}</Badge>
										{stop.locked ? (
											<Badge variant="outline">Locked</Badge>
										) : null}
										<Badge variant={stop.event.found ? "default" : "outline"}>
											{stop.event.found ? "Matched event" : "Event key only"}
										</Badge>
									</div>
									<p className="mt-2 text-sm font-semibold">
										{stop.event.name}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{stop.event.date || "No date"} ·{" "}
										{stop.event.areaLabel || stop.event.location || "No area"}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Arrive {stop.arrivalTime ?? "not set"} · depart{" "}
										{stop.departureTime ?? "not set"} · travel{" "}
										{stop.travelMinutesFromPrevious ?? 0} mins
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<Link href={withAdminBasePath(stop.event.publicPath)}>
											<Button type="button" variant="outline" size="sm">
												<ExternalLink />
												Event
											</Button>
										</Link>
										<Link
											href={withAdminBasePath(stop.event.ticketExchangePath)}
										>
											<Button type="button" variant="outline" size="sm">
												<ExternalLink />
												Exchange
											</Button>
										</Link>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												void copyValue("Event key", stop.event.eventKey)
											}
										>
											<Copy />
											Copy key
										</Button>
									</div>
								</div>
							))
						) : (
							<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
								This route has no synced stops.
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isSavedEventsOpen} onOpenChange={setIsSavedEventsOpen}>
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Saved Events</DialogTitle>
						<DialogDescription>
							{detail.savedEvents.length} event
							{detail.savedEvents.length === 1 ? "" : "s"} saved by this user.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						{detail.savedEvents.length > 0 ? (
							detail.savedEvents.map((saved) => (
								<div
									key={saved.eventKey}
									className="rounded-lg border bg-background/70 p-3"
								>
									<div className="flex flex-wrap items-center gap-2">
										<Badge variant={saved.event.found ? "default" : "outline"}>
											{saved.event.found ? "Matched event" : "Event key only"}
										</Badge>
										<Badge variant="outline">{saved.event.areaLabel}</Badge>
									</div>
									<p className="mt-2 text-sm font-semibold">
										{saved.event.name}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{saved.event.date || "No date"} ·{" "}
										{saved.event.location || "No location"}
									</p>
									<div className="mt-3 flex flex-wrap gap-2">
										<Link href={withAdminBasePath(saved.event.publicPath)}>
											<Button type="button" variant="outline" size="sm">
												<ExternalLink />
												Event
											</Button>
										</Link>
										<Link
											href={withAdminBasePath(saved.event.ticketExchangePath)}
										>
											<Button type="button" variant="outline" size="sm">
												<ExternalLink />
												Exchange
											</Button>
										</Link>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												void copyValue("Event key", saved.eventKey)
											}
										>
											<Copy />
											Copy key
										</Button>
									</div>
								</div>
							))
						) : (
							<div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
								No saved events.
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
