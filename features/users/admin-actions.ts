"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { getCurrentAdminActivityActor } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { getEventLocationDisplay } from "@/features/events/types";
import { getTicketExchangeRepository } from "@/features/ticket-exchange/repository";
import type { TicketExchangeListingStatus } from "@/features/ticket-exchange/types";
import { buildTicketExchangeEventPath } from "@/features/ticket-exchange/urls";
import { getAdminActivityRepository } from "@/lib/platform/postgres/admin-activity-repository";
import { getEventSubmissionRepository } from "@/lib/platform/postgres/event-submission-repository";
import { getUserEventRelationshipRepository } from "@/lib/platform/postgres/user-event-relationship-repository";
import { getUserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import { getUserRepository } from "@/lib/platform/postgres/user-repository";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getNoticeCtaHrefError, normalizeNoticeCtaHref } from "./notice-form";
import { getUserPolicyRepository } from "./policy-repository";
import type {
	AdminEventReference,
	AdminPlanDetail,
	AdminSavedEventDetail,
	AdminUserDetail,
	AdminUsersDashboard,
	AdminUsersQuery,
	ManagedUserStatus,
	UserNoticeTargetType,
	UserRestrictionScope,
} from "./types";
import {
	USER_NOTICE_SEVERITIES,
	USER_NOTICE_TARGET_TYPES,
	USER_RESTRICTION_SCOPES,
} from "./types";

type UserLookup = {
	userId?: string | null;
	email?: string | null;
};

const userStatusSchema = z.enum([
	"active",
	"unsubscribed",
	"deleted",
	"blocked",
]);
const restrictionScopeSchema = z.enum(USER_RESTRICTION_SCOPES);
const noticeTargetTypeSchema = z.enum(USER_NOTICE_TARGET_TYPES);
const noticeSeveritySchema = z.enum(USER_NOTICE_SEVERITIES);
const listingStatusSchema = z.enum(["active", "paused", "resolved", "removed"]);

const normalizeText = (value: string | null | undefined, maxLength: number) =>
	(typeof value === "string" ? value.trim() : "").slice(0, maxLength);

const normalizeEmail = (email: string | null | undefined): string | null => {
	const normalized = normalizeText(email, 254).toLowerCase();
	return normalized ? normalized : null;
};

const normalizeUserId = (userId: string | null | undefined): string | null => {
	const normalized = normalizeText(userId, 100);
	return normalized ? normalized : null;
};

const userHref = (lookup: UserLookup): string => {
	const target = lookup.userId || lookup.email || "";
	return `/admin/users/${encodeURIComponent(target)}`;
};

const eventPath = (event: {
	eventKey: string;
	slug?: string | null;
}): string => {
	const key = encodeURIComponent(event.eventKey);
	const slug = event.slug ? `/${encodeURIComponent(event.slug)}` : "";
	return `/event/${key}${slug}`;
};

const fallbackEventReference = (eventKey: string): AdminEventReference => ({
	eventKey,
	name: eventKey,
	slug: "",
	date: "",
	time: null,
	location: null,
	areaLabel: "Unknown",
	publicPath: eventPath({ eventKey }),
	ticketExchangePath: buildTicketExchangeEventPath({ eventKey }),
	found: false,
});

const getEventReferenceMap = async (
	eventKeys: string[],
): Promise<Map<string, AdminEventReference>> => {
	const normalizedKeys = new Set(
		eventKeys
			.map((eventKey) => eventKey.trim().toLowerCase())
			.filter((eventKey) => eventKey.length > 0),
	);
	if (normalizedKeys.size === 0) return new Map();

	const result = await getLiveEvents({
		includeFeaturedProjection: false,
		includeEngagementProjection: false,
	});
	const references = new Map<string, AdminEventReference>();
	for (const event of result.data) {
		const normalizedKey = event.eventKey.trim().toLowerCase();
		if (!normalizedKeys.has(normalizedKey)) continue;
		const locationDisplay = getEventLocationDisplay(event);
		references.set(normalizedKey, {
			eventKey: event.eventKey,
			name: event.name,
			slug: event.slug,
			date: event.date,
			time: event.time ?? null,
			location:
				locationDisplay.cardLabel ??
				locationDisplay.singleLocation ??
				event.location ??
				null,
			areaLabel: locationDisplay.areaShortLabel,
			publicPath: eventPath(event),
			ticketExchangePath: buildTicketExchangeEventPath(event),
			found: true,
		});
	}
	return references;
};

const resolveEventReference = (
	eventKey: string,
	references: Map<string, AdminEventReference>,
): AdminEventReference =>
	references.get(eventKey.trim().toLowerCase()) ??
	fallbackEventReference(eventKey);

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) throw new Error("Unauthorized access");
	const repository = getUserPolicyRepository();
	if (!repository)
		throw new Error("User management storage is not configured.");
	await getUserRepository()?.ensureReady();
	return repository;
};

const userTargetLabel = (lookup: UserLookup): string =>
	normalizeEmail(lookup.email) || normalizeUserId(lookup.userId) || "User";

export async function getAdminUsersDashboard(input?: {
	query?: string;
	status?: ManagedUserStatus | "all";
	activity?: AdminUsersQuery["activity"];
	audienceSignal?: AdminUsersQuery["audienceSignal"];
	sortKey?: AdminUsersQuery["sortKey"];
	sortDirection?: AdminUsersQuery["sortDirection"];
	page?: number;
	pageSize?: number;
}): Promise<AdminUsersDashboard> {
	try {
		const repository = await assertAdmin();
		const normalizedQuery: AdminUsersQuery = {
			query: input?.query,
			status: input?.status ?? "all",
			activity: input?.activity ?? "all",
			audienceSignal: input?.audienceSignal ?? "all",
			sortKey: input?.sortKey ?? "last_seen",
			sortDirection: input?.sortDirection ?? "desc",
			page: Math.max(input?.page ?? 1, 1),
			pageSize: Math.min(Math.max(input?.pageSize ?? 25, 1), 100),
		};
		const [
			usersPage,
			attentionUsersPage,
			activeRestrictions,
			globalNotices,
			recentNotes,
		] = await Promise.all([
			repository.listAdminUsersPage(normalizedQuery),
			repository.listAdminUsersPage({
				...normalizedQuery,
				activity: "needs_attention",
				page: 1,
				pageSize: 1,
			}),
			repository.listActiveRestrictions(40),
			repository.listGlobalNotices(40),
			repository.listRecentAdminNotes(10),
		]);
		return {
			supported: true,
			users: usersPage.users,
			activeRestrictions,
			globalNotices,
			recentNotes,
			totalUsers: usersPage.totalCount,
			attentionUserCount: attentionUsersPage.totalCount,
			page: usersPage.page,
			pageSize: usersPage.pageSize,
			totalPages: usersPage.totalPages,
			query: normalizedQuery,
		};
	} catch (error) {
		return {
			supported: false,
			users: [],
			activeRestrictions: [],
			globalNotices: [],
			recentNotes: [],
			totalUsers: 0,
			attentionUserCount: 0,
			page: 1,
			pageSize: 25,
			totalPages: 1,
			query: {
				status: "all",
				activity: "all",
				sortKey: "last_seen",
				sortDirection: "desc",
				page: 1,
				pageSize: 25,
			},
			error:
				error instanceof Error
					? error.message
					: "Unable to load user management.",
		};
	}
}

export async function getAdminUserDetail(lookup: string | UserLookup): Promise<{
	success: boolean;
	detail?: AdminUserDetail;
	error?: string;
}> {
	try {
		const repository = await assertAdmin();
		const normalizedLookup: UserLookup =
			typeof lookup === "string"
				? lookup.includes("@")
					? { email: lookup }
					: { userId: lookup }
				: lookup;
		const userIdInput = normalizeUserId(normalizedLookup.userId);
		const emailInput = normalizeEmail(normalizedLookup.email);

		const summary = await repository.getUserSummary({
			userId: userIdInput,
			email: emailInput,
		});
		const userId = summary?.userId ?? userIdInput;
		const email = summary?.email ?? emailInput;

		const collectedProfile = await UserCollectionStore.getUserProfile({
			userId: userId ?? undefined,
			email: email ?? undefined,
		});
		const collectedRecord = collectedProfile?.user ?? null;
		const finalUserId = userId ?? collectedRecord?.userId ?? null;
		const finalEmail = email ?? collectedRecord?.email ?? null;

		const [
			restrictions,
			notices,
			noticeReceipts,
			adminNotes,
			ticketListings,
			ticketReports,
			eventSubmissions,
			plans,
			savedEventKeys,
			activityEvents,
		] = await Promise.all([
			repository.listRestrictionsForUser({
				userId: finalUserId,
				email: finalEmail,
			}),
			repository.listNoticesForUser({ userId: finalUserId, email: finalEmail }),
			repository.listNoticeReceiptsForUser({
				userId: finalUserId,
				email: finalEmail,
			}),
			repository.listAdminNotesForUser({
				userId: finalUserId,
				email: finalEmail,
			}),
			getTicketExchangeRepository()?.getAdminListingsForUser({
				userId: finalUserId,
				email: finalEmail,
				limit: 80,
			}) ?? Promise.resolve([]),
			getTicketExchangeRepository()?.getAdminReportsForUser({
				userId: finalUserId,
				email: finalEmail,
				limit: 80,
			}) ?? Promise.resolve([]),
			finalEmail
				? (getEventSubmissionRepository()?.listSubmissionsByEmail(
						finalEmail,
						80,
					) ?? Promise.resolve([]))
				: Promise.resolve([]),
			finalUserId
				? (getUserPlanRepository()?.listPlans({
						ownerKey: `user:${finalUserId}`,
						limit: 80,
					}) ?? Promise.resolve([]))
				: Promise.resolve([]),
			finalUserId
				? (getUserEventRelationshipRepository()?.listEventKeysForUser({
						userId: finalUserId,
						relationshipType: "saved",
						limit: 1000,
					}) ?? Promise.resolve([]))
				: Promise.resolve([]),
			getAdminActivityRepository()?.listForTarget({
				targetType: "managed_user",
				targetId: finalUserId,
				targetLabel: finalEmail,
				limit: 80,
			}) ?? Promise.resolve([]),
		]);

		const eventReferences = await getEventReferenceMap([
			...savedEventKeys,
			...plans.flatMap((plan) => plan.stops.map((stop) => stop.eventKey)),
			...ticketListings.map((listing) => listing.eventKey),
			...eventSubmissions
				.flatMap((submission) => [
					submission.acceptedEventKey,
					submission.payload.originalEventKey,
				])
				.filter((eventKey): eventKey is string => Boolean(eventKey)),
		]);
		const savedEvents: AdminSavedEventDetail[] = savedEventKeys.map(
			(eventKey) => ({
				eventKey,
				event: resolveEventReference(eventKey, eventReferences),
			}),
		);
		const planDetails: AdminPlanDetail[] = plans.map((plan) => ({
			...plan,
			publicSharePath: plan.shareToken
				? `/plans/${encodeURIComponent(plan.shareToken)}`
				: null,
			resolvedStops: plan.stops.map((stop) => ({
				...stop,
				event: resolveEventReference(stop.eventKey, eventReferences),
			})),
		}));

		return {
			success: true,
			detail: {
				user: summary,
				collectedProfile,
				collectedRecord,
				restrictions,
				notices,
				noticeReceipts,
				adminNotes,
				ticketListings,
				ticketReports,
				eventSubmissions,
				plans: planDetails,
				savedEvents,
				savedEventKeys,
				activityEvents,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to load user detail.",
		};
	}
}

export async function createUserRestrictionAsAdmin(input: {
	userId?: string | null;
	email?: string | null;
	scope: UserRestrictionScope;
	reason: string;
	internalNote?: string | null;
	expiresAt?: string | null;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const repository = await assertAdmin();
		const actor = await getCurrentAdminActivityActor();
		const scope = restrictionScopeSchema.parse(input.scope);
		const restriction = await repository.createRestriction({
			userId: input.userId,
			email: input.email,
			scope,
			reason: input.reason,
			internalNote: input.internalNote,
			expiresAt: input.expiresAt,
			createdBy: actor.actorLabel,
		});
		await recordAdminActivity({
			action: "user.restriction.created",
			category: "auth",
			targetType: "managed_user",
			targetId: restriction.userId,
			targetLabel: restriction.email ?? userTargetLabel(input),
			summary: `Restricted ${scope} for ${restriction.email ?? restriction.userId ?? "user"}`,
			metadata: {
				restrictionId: restriction.id,
				scope,
				reason: restriction.reason,
				expiresAt: restriction.expiresAt,
			},
			severity: "warning",
			href: userHref({ userId: restriction.userId, email: restriction.email }),
		});
		revalidatePath("/admin/users");
		revalidatePath(
			userHref({ userId: restriction.userId, email: restriction.email }),
		);
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to create user restriction.",
		};
	}
}

export async function revokeUserRestrictionAsAdmin(input: {
	restrictionId: string;
	userId?: string | null;
	email?: string | null;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const repository = await assertAdmin();
		const actor = await getCurrentAdminActivityActor();
		const restriction = await repository.revokeRestriction({
			restrictionId: input.restrictionId,
			revokedBy: actor.actorLabel,
		});
		if (!restriction) throw new Error("Restriction not found.");
		await recordAdminActivity({
			action: "user.restriction.revoked",
			category: "auth",
			targetType: "managed_user",
			targetId: restriction.userId,
			targetLabel: restriction.email ?? userTargetLabel(input),
			summary: `Revoked ${restriction.scope} restriction`,
			metadata: { restrictionId: restriction.id, scope: restriction.scope },
			href: userHref({ userId: restriction.userId, email: restriction.email }),
		});
		revalidatePath("/admin/users");
		revalidatePath(
			userHref({ userId: restriction.userId, email: restriction.email }),
		);
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to revoke restriction.",
		};
	}
}

export async function createUserNoticeAsAdmin(input: {
	targetType: UserNoticeTargetType;
	targetUserId?: string | null;
	targetEmail?: string | null;
	segmentKey?: string | null;
	title: string;
	body: string;
	severity: string;
	ctaLabel?: string | null;
	ctaHref?: string | null;
	requiresAck?: boolean;
	dismissible?: boolean;
	startsAt?: string | null;
	expiresAt?: string | null;
	internalNote?: string | null;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const repository = await assertAdmin();
		const actor = await getCurrentAdminActivityActor();
		const targetType = noticeTargetTypeSchema.parse(input.targetType);
		const severity = noticeSeveritySchema.parse(input.severity);
		const ctaHrefError = getNoticeCtaHrefError(input.ctaHref);
		if (ctaHrefError) throw new Error(ctaHrefError);
		const notice = await repository.createNotice({
			targetType,
			targetUserId: input.targetUserId,
			targetEmail: input.targetEmail,
			segmentKey: input.segmentKey,
			title: input.title,
			body: input.body,
			severity,
			ctaLabel: input.ctaLabel,
			ctaHref: normalizeNoticeCtaHref(input.ctaHref),
			requiresAck: input.requiresAck,
			dismissible: input.dismissible,
			startsAt: input.startsAt,
			expiresAt: input.expiresAt,
			internalNote: input.internalNote,
			createdBy: actor.actorLabel,
		});
		await recordAdminActivity({
			action: "user.notice.created",
			category: "auth",
			targetType:
				targetType === "global" ? "global_user_notice" : "managed_user",
			targetId: notice.targetUserId,
			targetLabel:
				notice.targetEmail ??
				notice.segmentKey ??
				(targetType === "global" ? "Global notice" : "Authenticated users"),
			summary: `Created ${severity} notice: ${notice.title}`,
			metadata: {
				noticeId: notice.id,
				targetType,
				severity,
				requiresAck: notice.requiresAck,
				startsAt: notice.startsAt,
				expiresAt: notice.expiresAt,
			},
			severity:
				severity === "critical" || severity === "action_required"
					? "warning"
					: "info",
			href:
				notice.targetUserId || notice.targetEmail
					? userHref({
							userId: notice.targetUserId,
							email: notice.targetEmail,
						})
					: "/admin/users",
		});
		revalidatePath("/admin/users");
		if (notice.targetUserId || notice.targetEmail) {
			revalidatePath(
				userHref({ userId: notice.targetUserId, email: notice.targetEmail }),
			);
		}
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to create notice.",
		};
	}
}

export async function revokeUserNoticeAsAdmin(input: {
	noticeId: string;
	userId?: string | null;
	email?: string | null;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const repository = await assertAdmin();
		const actor = await getCurrentAdminActivityActor();
		const notice = await repository.revokeNotice({
			noticeId: input.noticeId,
			revokedBy: actor.actorLabel,
		});
		if (!notice) throw new Error("Notice not found.");
		await recordAdminActivity({
			action: "user.notice.revoked",
			category: "auth",
			targetType:
				notice.targetType === "global" ? "global_user_notice" : "managed_user",
			targetId: notice.targetUserId,
			targetLabel: notice.targetEmail ?? notice.segmentKey ?? notice.title,
			summary: `Revoked notice: ${notice.title}`,
			metadata: { noticeId: notice.id, targetType: notice.targetType },
			href:
				notice.targetUserId || notice.targetEmail
					? userHref({
							userId: notice.targetUserId,
							email: notice.targetEmail,
						})
					: "/admin/users",
		});
		revalidatePath("/admin/users");
		revalidatePath(userHref(input));
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to revoke notice.",
		};
	}
}

export async function addUserAdminNoteAsAdmin(input: {
	userId?: string | null;
	email?: string | null;
	category?: string | null;
	note: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const repository = await assertAdmin();
		const actor = await getCurrentAdminActivityActor();
		const note = await repository.addAdminNote({
			userId: input.userId,
			email: input.email,
			category: input.category,
			note: input.note,
			createdBy: actor.actorLabel,
		});
		await recordAdminActivity({
			action: "user.admin_note.created",
			category: "auth",
			targetType: "managed_user",
			targetId: note.userId,
			targetLabel: note.email ?? userTargetLabel(input),
			summary: `Added ${note.category} admin note`,
			metadata: { noteId: note.id, category: note.category },
			href: userHref({ userId: note.userId, email: note.email }),
		});
		revalidatePath("/admin/users");
		revalidatePath(userHref({ userId: note.userId, email: note.email }));
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to add note.",
		};
	}
}

export async function updateManagedUserStatusAsAdmin(input: {
	userId?: string | null;
	email?: string | null;
	status: ManagedUserStatus;
	reason: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		const repository = await assertAdmin();
		const status = userStatusSchema.parse(input.status);
		const reason = normalizeText(input.reason, 500);
		if (!reason) throw new Error("Status change reason is required.");
		const user = await repository.updateUserStatus({
			userId: input.userId,
			email: input.email,
			status,
		});
		if (!user) throw new Error("User not found.");
		await recordAdminActivity({
			action: "user.status.updated",
			category: "auth",
			targetType: "managed_user",
			targetId: user.userId,
			targetLabel: user.email,
			summary: `User status changed to ${status}`,
			metadata: { status, reason },
			severity:
				status === "blocked" || status === "deleted" ? "warning" : "info",
			href: userHref({ userId: user.userId, email: user.email }),
		});
		revalidatePath("/admin/users");
		revalidatePath(userHref({ userId: user.userId, email: user.email }));
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to update user status.",
		};
	}
}

export async function bulkUpdateUserTicketListingsAsAdmin(input: {
	userId?: string | null;
	email?: string | null;
	status: Extract<
		TicketExchangeListingStatus,
		"paused" | "resolved" | "removed"
	>;
	reason: string;
}): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
	try {
		await assertAdmin();
		const status = listingStatusSchema.parse(input.status) as Extract<
			TicketExchangeListingStatus,
			"paused" | "resolved" | "removed"
		>;
		const reason = normalizeText(input.reason, 500);
		if (!reason) throw new Error("Bulk listing update reason is required.");
		const ticketRepository = getTicketExchangeRepository();
		if (!ticketRepository) {
			throw new Error("Ticket Exchange storage is not configured.");
		}
		const listings = await ticketRepository.getAdminListingsForUser({
			userId: input.userId,
			email: input.email,
			limit: 100,
		});
		const targetListings = listings.filter(
			(listing) => listing.effectiveStatus === "active",
		);
		let updatedCount = 0;
		for (const listing of targetListings) {
			const result = await ticketRepository.updateListingStatusAsAdmin({
				listingId: listing.id,
				status,
			});
			if (result.updated) updatedCount += 1;
		}
		await recordAdminActivity({
			action: "user.ticket_listings.bulk_status_updated",
			category: "content",
			targetType: "managed_user",
			targetId: normalizeUserId(input.userId),
			targetLabel: userTargetLabel(input),
			summary: `Marked ${updatedCount} active ticket listing${updatedCount === 1 ? "" : "s"} ${status}`,
			metadata: { status, reason, updatedCount },
			severity: status === "removed" ? "destructive" : "warning",
			href: userHref(input),
		});
		revalidatePath("/admin/users");
		revalidatePath(userHref(input));
		revalidatePath("/exchange");
		revalidatePath("/tickets");
		return { success: true, updatedCount };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to update user listings.",
		};
	}
}

export async function updateUserTicketListingAsAdmin(input: {
	userId?: string | null;
	email?: string | null;
	listingId: string;
	status: Extract<
		TicketExchangeListingStatus,
		"active" | "paused" | "resolved" | "removed"
	>;
	reason: string;
}): Promise<{ success: boolean; error?: string }> {
	try {
		await assertAdmin();
		const status = listingStatusSchema.parse(input.status) as Extract<
			TicketExchangeListingStatus,
			"active" | "paused" | "resolved" | "removed"
		>;
		const listingId = normalizeText(input.listingId, 100);
		const reason = normalizeText(input.reason, 500);
		if (!listingId) throw new Error("Listing id is required.");
		if (!reason) throw new Error("Listing status reason is required.");
		const ticketRepository = getTicketExchangeRepository();
		if (!ticketRepository) {
			throw new Error("Ticket Exchange storage is not configured.");
		}
		const result = await ticketRepository.updateListingStatusAsAdmin({
			listingId,
			status,
		});
		if (!result.updated) throw new Error("Listing not found.");
		await recordAdminActivity({
			action: "user.ticket_listing.status_updated",
			category: "content",
			targetType: "managed_user",
			targetId: normalizeUserId(input.userId),
			targetLabel: userTargetLabel(input),
			summary: `Marked ticket listing ${status}`,
			metadata: { listingId, status, reason },
			severity: status === "removed" ? "destructive" : "warning",
			href: userHref(input),
		});
		revalidatePath("/admin/users");
		revalidatePath(userHref(input));
		revalidatePath("/exchange");
		revalidatePath("/tickets");
		if (result.eventKey) {
			const encodedEventKey = encodeURIComponent(result.eventKey);
			revalidatePath(`/exchange/${encodedEventKey}`);
			revalidatePath(`/tickets/${encodedEventKey}`);
		}
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to update ticket listing.",
		};
	}
}
