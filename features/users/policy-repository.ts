import "server-only";

import { randomUUID } from "crypto";
import { isValidUserId } from "@/features/auth/user-id";
import type { Sql } from "postgres";
import { getPostgresClient } from "@/lib/platform/postgres/postgres-client";
import type {
	AdminUserSummary,
	AdminUsersActivityFilter,
	AdminUsersQuery,
	AdminUsersSortDirection,
	AdminUsersSortKey,
	ManagedUserStatus,
	PublicUserNotice,
	UserAdminNote,
	UserAdminNoteCategory,
	UserNotice,
	UserNoticeReceipt,
	UserNoticeSeverity,
	UserNoticeTargetType,
	UserPolicyDecision,
	UserRestriction,
	UserRestrictionScope,
} from "./types";
import {
	getNoticeCtaHrefError,
	getNoticeLifecycleError,
	normalizeNoticeCtaHref,
} from "./notice-form";
import {
	USER_ADMIN_NOTE_CATEGORIES,
	USER_NOTICE_SEVERITIES,
	USER_NOTICE_TARGET_TYPES,
	USER_RESTRICTION_SCOPES,
} from "./types";

declare global {
	var __ooocFeteFinderUserPolicyRepository: UserPolicyRepository | undefined;
}

type RestrictionRow = {
	id: string;
	user_id: string | null;
	email_normalized: string | null;
	scope: UserRestrictionScope;
	reason: string;
	internal_note: string;
	starts_at: Date | string;
	expires_at: Date | string | null;
	created_by: string;
	created_at: Date | string;
	revoked_at: Date | string | null;
	revoked_by: string | null;
	is_active: boolean;
};

type NoticeRow = {
	id: string;
	target_type: UserNoticeTargetType;
	target_user_id: string | null;
	target_email_normalized: string | null;
	segment_key: string | null;
	title: string;
	body: string;
	severity: UserNoticeSeverity;
	cta_label: string | null;
	cta_href: string | null;
	requires_ack: boolean;
	dismissible: boolean;
	starts_at: Date | string;
	expires_at: Date | string | null;
	created_by: string;
	created_at: Date | string;
	revoked_at: Date | string | null;
	revoked_by: string | null;
	internal_note: string;
	is_active: boolean;
	delivered_count?: number;
	read_count?: number;
	dismissed_count?: number;
	acknowledged_count?: number;
	recipient_read_at?: Date | string | null;
	recipient_dismissed_at?: Date | string | null;
	recipient_acknowledged_at?: Date | string | null;
};

type NoticeReceiptRow = {
	id: string;
	notice_id: string;
	user_id: string | null;
	email_normalized: string | null;
	delivered_at: Date | string;
	read_at: Date | string | null;
	dismissed_at: Date | string | null;
	acknowledged_at: Date | string | null;
};

type AdminNoteRow = {
	id: string;
	user_id: string | null;
	email_normalized: string | null;
	category: UserAdminNoteCategory;
	note: string;
	created_by: string;
	created_at: Date | string;
};

type UserSummaryRow = {
	user_id: string;
	email: string;
	first_name: string;
	last_name: string;
	status: ManagedUserStatus;
	source: string;
	first_seen_at: Date | string;
	last_seen_at: Date | string;
	last_authenticated_at: Date | string | null;
	marketing_consent: boolean;
	event_update_consent: boolean;
	active_restriction_count: number;
	open_notice_count: number;
	admin_note_count: number;
	ticket_listing_count: number;
	active_ticket_listing_count: number;
	open_ticket_report_count: number;
	ticket_report_count: number;
	ticket_reports_made_count: number;
	ticket_reports_against_listing_count: number;
	event_submission_count: number;
	plan_count: number;
	saved_event_count: number;
	total_count?: number;
};

type AdminUsersPageResult = {
	users: AdminUserSummary[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
};

const toIso = (value: Date | string | null): string | null => {
	if (!value) return null;
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

const normalizeEmail = (email: string | null | undefined): string | null => {
	if (typeof email !== "string") return null;
	const normalized = email.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
};

const normalizeText = (
	value: string | null | undefined,
	maxLength: number,
): string => {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, maxLength);
};

const normalizeNullableText = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	const normalized = normalizeText(value, maxLength);
	return normalized.length > 0 ? normalized : null;
};

const normalizeUserId = (userId: string | null | undefined): string | null => {
	const normalized = normalizeNullableText(userId, 100);
	return normalized && isValidUserId(normalized) ? normalized : null;
};

const isRestrictionScope = (scope: string): scope is UserRestrictionScope =>
	(USER_RESTRICTION_SCOPES as readonly string[]).includes(scope);

const isNoticeTargetType = (
	targetType: string,
): targetType is UserNoticeTargetType =>
	(USER_NOTICE_TARGET_TYPES as readonly string[]).includes(targetType);

const isNoticeSeverity = (severity: string): severity is UserNoticeSeverity =>
	(USER_NOTICE_SEVERITIES as readonly string[]).includes(severity);

const isAdminNoteCategory = (
	category: string,
): category is UserAdminNoteCategory =>
	(USER_ADMIN_NOTE_CATEGORIES as readonly string[]).includes(category);

const activeExpression = (sql: Sql) => sql`
	revoked_at IS NULL
	AND starts_at <= NOW()
	AND (expires_at IS NULL OR expires_at > NOW())
`;

const toRestriction = (row: RestrictionRow): UserRestriction => ({
	id: row.id,
	userId: row.user_id,
	email: row.email_normalized,
	scope: row.scope,
	reason: row.reason,
	internalNote: row.internal_note,
	startsAt: toIso(row.starts_at) ?? new Date(0).toISOString(),
	expiresAt: toIso(row.expires_at),
	createdBy: row.created_by,
	createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
	revokedAt: toIso(row.revoked_at),
	revokedBy: row.revoked_by,
	isActive: Boolean(row.is_active),
});

const toNotice = (row: NoticeRow): UserNotice => ({
	id: row.id,
	targetType: row.target_type,
	targetUserId: row.target_user_id,
	targetEmail: row.target_email_normalized,
	segmentKey: row.segment_key,
	title: row.title,
	body: row.body,
	severity: row.severity,
	ctaLabel: row.cta_label,
	ctaHref: row.cta_href,
	requiresAck: row.requires_ack,
	dismissible: row.dismissible,
	startsAt: toIso(row.starts_at) ?? new Date(0).toISOString(),
	expiresAt: toIso(row.expires_at),
	createdBy: row.created_by,
	createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
	revokedAt: toIso(row.revoked_at),
	revokedBy: row.revoked_by,
	internalNote: row.internal_note,
	isActive: Boolean(row.is_active),
	deliveredCount: row.delivered_count,
	readCount: row.read_count,
	dismissedCount: row.dismissed_count,
	acknowledgedCount: row.acknowledged_count,
	recipientReadAt: toIso(row.recipient_read_at ?? null),
	recipientDismissedAt: toIso(row.recipient_dismissed_at ?? null),
	recipientAcknowledgedAt: toIso(row.recipient_acknowledged_at ?? null),
});

const toReceipt = (row: NoticeReceiptRow): UserNoticeReceipt => ({
	id: row.id,
	noticeId: row.notice_id,
	userId: row.user_id,
	email: row.email_normalized,
	deliveredAt: toIso(row.delivered_at) ?? new Date(0).toISOString(),
	readAt: toIso(row.read_at),
	dismissedAt: toIso(row.dismissed_at),
	acknowledgedAt: toIso(row.acknowledged_at),
});

const toAdminNote = (row: AdminNoteRow): UserAdminNote => ({
	id: row.id,
	userId: row.user_id,
	email: row.email_normalized,
	category: row.category,
	note: row.note,
	createdBy: row.created_by,
	createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
});

const toUserSummary = (row: UserSummaryRow): AdminUserSummary => ({
	userId: row.user_id,
	email: row.email,
	firstName: row.first_name,
	lastName: row.last_name,
	status: row.status,
	source: row.source,
	firstSeenAt: toIso(row.first_seen_at) ?? new Date(0).toISOString(),
	lastSeenAt: toIso(row.last_seen_at) ?? new Date(0).toISOString(),
	lastAuthenticatedAt: toIso(row.last_authenticated_at),
	marketingConsent: row.marketing_consent,
	eventUpdateConsent: row.event_update_consent,
	activeRestrictionCount: row.active_restriction_count,
	openNoticeCount: row.open_notice_count,
	adminNoteCount: row.admin_note_count,
	ticketListingCount: row.ticket_listing_count,
	activeTicketListingCount: row.active_ticket_listing_count,
	openTicketReportCount: row.open_ticket_report_count,
	ticketReportCount: row.ticket_report_count,
	ticketReportsMadeCount: row.ticket_reports_made_count,
	ticketReportsAgainstListingCount: row.ticket_reports_against_listing_count,
	eventSubmissionCount: row.event_submission_count,
	planCount: row.plan_count,
	savedEventCount: row.saved_event_count,
});

export class UserPolicyRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_restrictions (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				email_normalized TEXT,
				scope TEXT NOT NULL CHECK (scope IN (
					'all_user_actions',
					'auth.login',
					'ticket_exchange.post',
					'ticket_exchange.contact_unlock',
					'ticket_exchange.report',
					'event_submission.create',
					'plans.sync',
					'saved_events.sync',
					'user_preferences.write',
					'app_settings.sync'
				)),
				reason TEXT NOT NULL,
				internal_note TEXT NOT NULL DEFAULT '',
				starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				expires_at TIMESTAMPTZ,
				created_by TEXT NOT NULL DEFAULT 'admin-panel',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				revoked_at TIMESTAMPTZ,
				revoked_by TEXT,
				CHECK (user_id IS NOT NULL OR email_normalized IS NOT NULL)
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_notices (
				id TEXT PRIMARY KEY,
				target_type TEXT NOT NULL CHECK (target_type IN ('user', 'email', 'segment', 'global', 'authenticated_users')),
				target_user_id TEXT,
				target_email_normalized TEXT,
				segment_key TEXT,
				title TEXT NOT NULL,
				body TEXT NOT NULL,
				severity TEXT NOT NULL CHECK (severity IN ('info', 'success', 'warning', 'action_required', 'critical')),
				cta_label TEXT,
				cta_href TEXT,
				requires_ack BOOLEAN NOT NULL DEFAULT FALSE,
				dismissible BOOLEAN NOT NULL DEFAULT TRUE,
				starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				expires_at TIMESTAMPTZ,
				created_by TEXT NOT NULL DEFAULT 'admin-panel',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				revoked_at TIMESTAMPTZ,
				revoked_by TEXT,
				internal_note TEXT NOT NULL DEFAULT '',
				CHECK (
					target_type IN ('global', 'authenticated_users')
					OR (target_type = 'user' AND target_user_id IS NOT NULL)
					OR (target_type = 'email' AND target_email_normalized IS NOT NULL)
					OR (target_type = 'segment' AND segment_key IS NOT NULL)
				)
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_notice_receipts (
				id TEXT PRIMARY KEY,
				notice_id TEXT NOT NULL REFERENCES app_user_notices(id) ON DELETE CASCADE,
				user_id TEXT,
				email_normalized TEXT,
				delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				read_at TIMESTAMPTZ,
				dismissed_at TIMESTAMPTZ,
				acknowledged_at TIMESTAMPTZ,
				CHECK (user_id IS NOT NULL OR email_normalized IS NOT NULL)
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_admin_notes (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				email_normalized TEXT,
				category TEXT NOT NULL CHECK (category IN ('general', 'policy', 'support', 'fraud', 'privacy')),
				note TEXT NOT NULL,
				created_by TEXT NOT NULL DEFAULT 'admin-panel',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				CHECK (user_id IS NOT NULL OR email_normalized IS NOT NULL)
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_restrictions_user_active
			ON app_user_restrictions (user_id, scope, starts_at DESC)
			WHERE revoked_at IS NULL
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_restrictions_email_active
			ON app_user_restrictions (email_normalized, scope, starts_at DESC)
			WHERE revoked_at IS NULL
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_notices_target_active
			ON app_user_notices (target_type, starts_at DESC)
			WHERE revoked_at IS NULL
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_notice_receipts_notice_user
			ON app_user_notice_receipts (notice_id, user_id, email_normalized)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_admin_notes_user
			ON app_user_admin_notes (user_id, created_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_admin_notes_email
			ON app_user_admin_notes (email_normalized, created_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async getRestrictionDecision(input: {
		userId?: string | null;
		email?: string | null;
		scope: UserRestrictionScope;
	}): Promise<UserPolicyDecision> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		const scopes = [
			"all_user_actions",
			input.scope,
		] satisfies UserRestrictionScope[];

		if (input.scope === "auth.login" && email) {
			const tableRows = await this.sql<Array<{ users_table: string | null }>>`
				SELECT to_regclass('app_users')::text AS users_table
			`;
			if (tableRows[0]?.users_table) {
				const blockedUserRows = await this.sql<
					Array<{ status: ManagedUserStatus }>
				>`
					SELECT status::text AS status
					FROM app_users
					WHERE email_normalized = ${email}
						AND status IN ('blocked', 'deleted')
					LIMIT 1
				`;
				const status = blockedUserRows[0]?.status;
				if (status === "blocked" || status === "deleted") {
					return {
						allowed: false,
						restriction: null,
						reason:
							status === "blocked"
								? "This account is blocked."
								: "This account is no longer active.",
					};
				}
			}
		}

		if (!userId && !email) {
			return { allowed: true, restriction: null, reason: null };
		}

		const rows = await this.sql<RestrictionRow[]>`
			SELECT
				id,
				user_id,
				email_normalized,
				scope::text AS scope,
				reason,
				internal_note,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				(${activeExpression(this.sql)}) AS is_active
			FROM app_user_restrictions
			WHERE ${activeExpression(this.sql)}
				AND scope = ANY(${scopes})
				AND (
					(${userId}::text IS NOT NULL AND user_id = ${userId})
					OR (${email}::text IS NOT NULL AND email_normalized = ${email})
				)
			ORDER BY
				CASE WHEN scope = 'all_user_actions' THEN 0 ELSE 1 END,
				created_at DESC
			LIMIT 1
		`;
		const restriction = rows[0] ? toRestriction(rows[0]) : null;
		return restriction
			? {
					allowed: false,
					restriction,
					reason: restriction.reason || "This action is restricted.",
				}
			: { allowed: true, restriction: null, reason: null };
	}

	async createRestriction(input: {
		userId?: string | null;
		email?: string | null;
		scope: string;
		reason: string;
		internalNote?: string | null;
		expiresAt?: string | null;
		createdBy: string;
	}): Promise<UserRestriction> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) throw new Error("User or email is required.");
		if (!isRestrictionScope(input.scope)) {
			throw new Error("Choose a valid restriction scope.");
		}
		const reason = normalizeText(input.reason, 500);
		if (!reason) throw new Error("Restriction reason is required.");
		const expiresAt = normalizeNullableText(input.expiresAt, 80);
		if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
			throw new Error("Restriction expiry must be a valid date.");
		}

		const rows = await this.sql<RestrictionRow[]>`
			INSERT INTO app_user_restrictions (
				id,
				user_id,
				email_normalized,
				scope,
				reason,
				internal_note,
				expires_at,
				created_by
			)
			VALUES (
				${randomUUID()},
				${userId},
				${email},
				${input.scope},
				${reason},
				${normalizeText(input.internalNote, 2000)},
				${expiresAt},
				${normalizeText(input.createdBy, 160) || "admin-panel"}
			)
			RETURNING
				id,
				user_id,
				email_normalized,
				scope::text AS scope,
				reason,
				internal_note,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				(${activeExpression(this.sql)}) AS is_active
		`;
		return toRestriction(rows[0]);
	}

	async revokeRestriction(input: {
		restrictionId: string;
		revokedBy: string;
	}): Promise<UserRestriction | null> {
		await this.ready();
		const rows = await this.sql<RestrictionRow[]>`
			UPDATE app_user_restrictions
			SET
				revoked_at = COALESCE(revoked_at, NOW()),
				revoked_by = COALESCE(revoked_by, ${normalizeText(input.revokedBy, 160) || "admin-panel"})
			WHERE id = ${normalizeText(input.restrictionId, 100)}
			RETURNING
				id,
				user_id,
				email_normalized,
				scope::text AS scope,
				reason,
				internal_note,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				(${activeExpression(this.sql)}) AS is_active
		`;
		return rows[0] ? toRestriction(rows[0]) : null;
	}

	async createNotice(input: {
		targetType: string;
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
		createdBy: string;
		internalNote?: string | null;
	}): Promise<UserNotice> {
		await this.ready();
		if (!isNoticeTargetType(input.targetType)) {
			throw new Error("Choose a valid notice target.");
		}
		if (!isNoticeSeverity(input.severity)) {
			throw new Error("Choose a valid notice level.");
		}
		const targetUserId = normalizeUserId(input.targetUserId);
		const targetEmail = normalizeEmail(input.targetEmail);
		const segmentKey = normalizeNullableText(input.segmentKey, 100);
		if (input.targetType === "user" && !targetUserId) {
			throw new Error("User-targeted notices require a user id.");
		}
		if (input.targetType === "email" && !targetEmail) {
			throw new Error("Email-targeted notices require an email.");
		}
		if (input.targetType === "segment" && !segmentKey) {
			throw new Error("Segment notices require a segment key.");
		}
		const title = normalizeText(input.title, 140);
		const body = normalizeText(input.body, 2000);
		if (!title || !body) {
			throw new Error("Notice title and body are required.");
		}
		const ctaLabel = normalizeNullableText(input.ctaLabel, 80);
		const ctaHrefError = getNoticeCtaHrefError(input.ctaHref);
		if (ctaHrefError) throw new Error(ctaHrefError);
		const ctaHref = normalizeNoticeCtaHref(input.ctaHref);
		if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
			throw new Error("CTA label and link must be provided together.");
		}
		const expiresAt = normalizeNullableText(input.expiresAt, 80);
		if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
			throw new Error("Notice expiry must be a valid date.");
		}
		const startsAt = normalizeNullableText(input.startsAt, 80);
		if (startsAt && Number.isNaN(Date.parse(startsAt))) {
			throw new Error("Notice start time must be a valid date.");
		}
		const requiresAck = Boolean(input.requiresAck);
		const dismissible = requiresAck ? false : input.dismissible !== false;
		const lifecycleError = getNoticeLifecycleError({
			requiresAck,
			dismissible,
			startsAt,
			expiresAt,
		});
		if (lifecycleError) throw new Error(lifecycleError);

		const rows = await this.sql<NoticeRow[]>`
			INSERT INTO app_user_notices (
				id,
				target_type,
				target_user_id,
				target_email_normalized,
				segment_key,
				title,
				body,
				severity,
				cta_label,
				cta_href,
				requires_ack,
				dismissible,
				starts_at,
				expires_at,
				created_by,
				internal_note
			)
			VALUES (
				${randomUUID()},
				${input.targetType},
				${targetUserId},
				${targetEmail},
				${segmentKey},
				${title},
				${body},
				${input.severity},
				${ctaLabel},
				${ctaHref},
				${requiresAck},
				${dismissible},
				COALESCE(${startsAt}::timestamptz, NOW()),
				${expiresAt},
				${normalizeText(input.createdBy, 160) || "admin-panel"},
				${normalizeText(input.internalNote, 2000)}
			)
			RETURNING
				id,
				target_type::text AS target_type,
				target_user_id,
				target_email_normalized,
				segment_key,
				title,
				body,
				severity::text AS severity,
				cta_label,
				cta_href,
				requires_ack,
				dismissible,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				internal_note,
				(${activeExpression(this.sql)}) AS is_active
		`;
		return toNotice(rows[0]);
	}

	async revokeNotice(input: {
		noticeId: string;
		revokedBy: string;
	}): Promise<UserNotice | null> {
		await this.ready();
		const rows = await this.sql<NoticeRow[]>`
			UPDATE app_user_notices
			SET
				revoked_at = COALESCE(revoked_at, NOW()),
				revoked_by = COALESCE(revoked_by, ${normalizeText(input.revokedBy, 160) || "admin-panel"})
			WHERE id = ${normalizeText(input.noticeId, 100)}
			RETURNING
				id,
				target_type::text AS target_type,
				target_user_id,
				target_email_normalized,
				segment_key,
				title,
				body,
				severity::text AS severity,
				cta_label,
				cta_href,
				requires_ack,
				dismissible,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				internal_note,
				(${activeExpression(this.sql)}) AS is_active
		`;
		return rows[0] ? toNotice(rows[0]) : null;
	}

	async addAdminNote(input: {
		userId?: string | null;
		email?: string | null;
		category?: string | null;
		note: string;
		createdBy: string;
	}): Promise<UserAdminNote> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) throw new Error("User or email is required.");
		const categoryCandidate = normalizeText(input.category, 40);
		const category = isAdminNoteCategory(categoryCandidate)
			? categoryCandidate
			: "general";
		const note = normalizeText(input.note, 3000);
		if (!note) throw new Error("Admin note is required.");

		const rows = await this.sql<AdminNoteRow[]>`
			INSERT INTO app_user_admin_notes (
				id,
				user_id,
				email_normalized,
				category,
				note,
				created_by
			)
			VALUES (
				${randomUUID()},
				${userId},
				${email},
				${category},
				${note},
				${normalizeText(input.createdBy, 160) || "admin-panel"}
			)
			RETURNING
				id,
				user_id,
				email_normalized,
				category::text AS category,
				note,
				created_by,
				created_at
		`;
		return toAdminNote(rows[0]);
	}

	async listAdminUsersPage(
		input?: AdminUsersQuery & { limit?: number },
	): Promise<AdminUsersPageResult> {
		await this.ready();
		const query = normalizeNullableText(input?.query, 120);
		const pageSize = Math.min(
			Math.max(input?.pageSize ?? input?.limit ?? 25, 1),
			100,
		);
		const page = Math.max(input?.page ?? 1, 1);
		const offset = (page - 1) * pageSize;
		const status =
			input?.status && input.status !== "all" ? input.status : null;
		const search = query ? `%${query.toLowerCase()}%` : null;
		const activity = input?.activity ?? "all";
		const sortKey = input?.sortKey ?? "last_seen";
		const sortDirection =
			input?.sortDirection === "asc" ? "asc" : ("desc" as const);
		const tableRows = await this.sql<
			Array<{
				ticket_listings_table: string | null;
				ticket_reports_table: string | null;
				submissions_table: string | null;
				plans_table: string | null;
				relationships_table: string | null;
			}>
		>`
			SELECT
				to_regclass('ticket_exchange_listings')::text AS ticket_listings_table,
				to_regclass('ticket_exchange_reports')::text AS ticket_reports_table,
				to_regclass('app_event_submissions')::text AS submissions_table,
				to_regclass('app_user_plans')::text AS plans_table,
				to_regclass('app_user_event_relationships')::text AS relationships_table
		`;
		const tables = tableRows[0];
		const activityFilter = ((): ReturnType<Sql> => {
			switch (activity satisfies AdminUsersActivityFilter) {
				case "needs_attention":
					return this.sql`(
						status IN ('blocked', 'deleted')
						OR active_restriction_count > 0
						OR open_notice_count > 0
						OR open_ticket_report_count > 0
					)`;
				case "has_restrictions":
					return this.sql`active_restriction_count > 0`;
				case "has_notices":
					return this.sql`open_notice_count > 0`;
				case "has_ticket_listings":
					return this.sql`ticket_listing_count > 0`;
				case "has_active_ticket_listings":
					return this.sql`active_ticket_listing_count > 0`;
				case "has_ticket_reports":
					return this.sql`ticket_report_count > 0`;
				case "has_submissions":
					return this.sql`event_submission_count > 0`;
				case "has_plans":
					return this.sql`plan_count > 0`;
				case "has_saved_events":
					return this.sql`saved_event_count > 0`;
				case "all":
				default:
					return this.sql`TRUE`;
			}
		})();
		const sortExpression = ((): ReturnType<Sql> => {
			const direction = sortDirection satisfies AdminUsersSortDirection;
			const byDirection = (
				desc: ReturnType<Sql>,
				asc: ReturnType<Sql>,
			): ReturnType<Sql> => (direction === "asc" ? asc : desc);
			switch (sortKey satisfies AdminUsersSortKey) {
				case "first_seen":
					return byDirection(
						this.sql`first_seen_at DESC, last_seen_at DESC`,
						this.sql`first_seen_at ASC, last_seen_at DESC`,
					);
				case "active_restrictions":
					return byDirection(
						this.sql`active_restriction_count DESC, last_seen_at DESC`,
						this.sql`active_restriction_count ASC, last_seen_at DESC`,
					);
				case "open_notices":
					return byDirection(
						this.sql`open_notice_count DESC, last_seen_at DESC`,
						this.sql`open_notice_count ASC, last_seen_at DESC`,
					);
				case "ticket_listings":
					return byDirection(
						this.sql`ticket_listing_count DESC, last_seen_at DESC`,
						this.sql`ticket_listing_count ASC, last_seen_at DESC`,
					);
				case "active_ticket_listings":
					return byDirection(
						this.sql`active_ticket_listing_count DESC, last_seen_at DESC`,
						this.sql`active_ticket_listing_count ASC, last_seen_at DESC`,
					);
				case "ticket_reports":
					return byDirection(
						this
							.sql`open_ticket_report_count DESC, ticket_reports_against_listing_count DESC, ticket_reports_made_count DESC, ticket_report_count DESC, last_seen_at DESC`,
						this
							.sql`open_ticket_report_count ASC, ticket_reports_against_listing_count ASC, ticket_reports_made_count ASC, ticket_report_count ASC, last_seen_at DESC`,
					);
				case "event_submissions":
					return byDirection(
						this.sql`event_submission_count DESC, last_seen_at DESC`,
						this.sql`event_submission_count ASC, last_seen_at DESC`,
					);
				case "plans":
					return byDirection(
						this.sql`plan_count DESC, last_seen_at DESC`,
						this.sql`plan_count ASC, last_seen_at DESC`,
					);
				case "saved_events":
					return byDirection(
						this.sql`saved_event_count DESC, last_seen_at DESC`,
						this.sql`saved_event_count ASC, last_seen_at DESC`,
					);
				case "last_seen":
				default:
					return byDirection(
						this.sql`last_seen_at DESC, first_seen_at DESC`,
						this.sql`last_seen_at ASC, first_seen_at ASC`,
					);
			}
		})();

		const rows = await this.sql<UserSummaryRow[]>`
			WITH base AS (
				SELECT
					users.id AS user_id,
					users.email_normalized AS email,
					users.first_name,
					users.last_name,
					users.status::text AS status,
					users.source,
					users.first_seen_at,
					users.last_seen_at,
					users.last_authenticated_at,
					users.marketing_consent,
					users.event_update_consent,
					(
						SELECT COUNT(*)::int
						FROM app_user_restrictions restrictions
						WHERE ${activeExpression(this.sql)}
							AND (
								restrictions.user_id = users.id
								OR restrictions.email_normalized = users.email_normalized
							)
					) AS active_restriction_count,
					(
						SELECT COUNT(*)::int
						FROM app_user_notices notices
						LEFT JOIN LATERAL (
							SELECT dismissed_at, acknowledged_at
							FROM app_user_notice_receipts receipts
							WHERE receipts.notice_id = notices.id
								AND (
									receipts.user_id = users.id
									OR receipts.email_normalized = users.email_normalized
								)
							ORDER BY delivered_at DESC
							LIMIT 1
						) notice_receipt ON TRUE
						WHERE ${activeExpression(this.sql)}
							AND (
								notices.target_user_id = users.id
								OR notices.target_email_normalized = users.email_normalized
							)
							AND (
								(notices.requires_ack = TRUE AND notice_receipt.acknowledged_at IS NULL)
								OR (
									notices.requires_ack = FALSE
									AND notices.dismissible = TRUE
									AND notice_receipt.dismissed_at IS NULL
								)
							)
					) AS open_notice_count,
					(
						SELECT COUNT(*)::int
						FROM app_user_admin_notes notes
						WHERE notes.user_id = users.id
							OR notes.email_normalized = users.email_normalized
					) AS admin_note_count,
						${
							tables?.ticket_listings_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM ticket_exchange_listings listings
										WHERE listings.owner_user_id = users.id
											OR LOWER(listings.owner_email) = users.email_normalized
									)
								`
								: this.sql`0::int`
						} AS ticket_listing_count,
						${
							tables?.ticket_listings_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM ticket_exchange_listings listings
										WHERE (listings.owner_user_id = users.id
												OR LOWER(listings.owner_email) = users.email_normalized)
											AND listings.status = 'active'
											AND listings.expires_at > NOW()
									)
								`
								: this.sql`0::int`
						} AS active_ticket_listing_count,
						${
							tables?.ticket_reports_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM ticket_exchange_reports reports
										${
											tables.ticket_listings_table
												? this.sql`
													LEFT JOIN ticket_exchange_listings report_listings
														ON report_listings.id = reports.listing_id
												`
												: this.sql``
										}
										WHERE reports.reviewed_at IS NULL
											${
												tables.ticket_listings_table
													? this.sql`
														AND (
															report_listings.owner_user_id = users.id
															OR LOWER(report_listings.owner_email) = users.email_normalized
														)
													`
													: this.sql`AND FALSE`
											}
									)
								`
								: this.sql`0::int`
						} AS open_ticket_report_count,
						${
							tables?.ticket_reports_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM ticket_exchange_reports reports
										${
											tables.ticket_listings_table
												? this.sql`
													LEFT JOIN ticket_exchange_listings report_listings
														ON report_listings.id = reports.listing_id
												`
												: this.sql``
										}
										WHERE (
											reports.reporter_user_id = users.id
											${
												tables.ticket_listings_table
													? this.sql`
														OR report_listings.owner_user_id = users.id
														OR LOWER(report_listings.owner_email) = users.email_normalized
													`
													: this.sql``
											}
										)
									)
								`
								: this.sql`0::int`
						} AS ticket_report_count,
						${
							tables?.ticket_reports_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM ticket_exchange_reports reports
										WHERE reports.reporter_user_id = users.id
									)
								`
								: this.sql`0::int`
						} AS ticket_reports_made_count,
						${
							tables?.ticket_reports_table && tables.ticket_listings_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM ticket_exchange_reports reports
										LEFT JOIN ticket_exchange_listings report_listings
											ON report_listings.id = reports.listing_id
										WHERE report_listings.owner_user_id = users.id
											OR LOWER(report_listings.owner_email) = users.email_normalized
									)
								`
								: this.sql`0::int`
						} AS ticket_reports_against_listing_count,
						${
							tables?.submissions_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM app_event_submissions submissions
										WHERE LOWER(submissions.host_email) = users.email_normalized
									)
								`
								: this.sql`0::int`
						} AS event_submission_count,
						${
							tables?.plans_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM app_user_plans plans
										WHERE plans.user_id = users.id
											OR plans.owner_key = ${"user:"} || users.id
									)
								`
								: this.sql`0::int`
						} AS plan_count,
						${
							tables?.relationships_table
								? this.sql`
									(
										SELECT COUNT(*)::int
										FROM app_user_event_relationships relationships
										WHERE relationships.user_id = users.id
											AND relationships.relationship_type = 'saved'
									)
								`
								: this.sql`0::int`
						} AS saved_event_count
					FROM app_users users
			),
			filtered AS (
				SELECT *
				FROM base
				WHERE (${status}::text IS NULL OR status = ${status})
					AND (
						${search}::text IS NULL
						OR email ILIKE ${search}
						OR first_name ILIKE ${search}
						OR last_name ILIKE ${search}
						OR user_id ILIKE ${search}
					)
					AND ${activityFilter}
				)
			SELECT
				filtered.*,
				COUNT(*) OVER()::int AS total_count
			FROM filtered
			ORDER BY ${sortExpression}
			LIMIT ${pageSize}
			OFFSET ${offset}
		`;
		const totalCount = rows[0]?.total_count ?? 0;
		return {
			users: rows.map(toUserSummary),
			totalCount,
			page,
			pageSize,
			totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
		};
	}

	async listAdminUsers(
		input?: AdminUsersQuery & { limit?: number },
	): Promise<AdminUserSummary[]> {
		return (await this.listAdminUsersPage(input)).users;
	}

	async listActiveRestrictions(limit = 80): Promise<UserRestriction[]> {
		await this.ready();
		const safeLimit = Math.min(Math.max(limit, 1), 200);
		const rows = await this.sql<RestrictionRow[]>`
			SELECT
				id,
				user_id,
				email_normalized,
				scope::text AS scope,
				reason,
				internal_note,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				(${activeExpression(this.sql)}) AS is_active
			FROM app_user_restrictions
			WHERE ${activeExpression(this.sql)}
			ORDER BY created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map(toRestriction);
	}

	async updateUserStatus(input: {
		userId?: string | null;
		email?: string | null;
		status: ManagedUserStatus;
	}): Promise<AdminUserSummary | null> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) throw new Error("User or email is required.");

		await this.sql`
			UPDATE app_users
			SET status = ${input.status}, updated_at = NOW()
			WHERE
				(${userId}::text IS NOT NULL AND id = ${userId})
				OR (${email}::text IS NOT NULL AND email_normalized = ${email})
		`;

		return this.getUserSummary({ userId, email });
	}

	async getUserSummary(input: {
		userId?: string | null;
		email?: string | null;
	}): Promise<AdminUserSummary | null> {
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return null;
		const rows = await this.listAdminUsers({
			query: userId ?? email ?? "",
			limit: 10,
			status: "all",
		});
		return (
			rows.find(
				(row) =>
					(userId && row.userId === userId) || (email && row.email === email),
			) ?? null
		);
	}

	async listRestrictionsForUser(input: {
		userId?: string | null;
		email?: string | null;
		limit?: number;
	}): Promise<UserRestriction[]> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return [];
		const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);
		const rows = await this.sql<RestrictionRow[]>`
			SELECT
				id,
				user_id,
				email_normalized,
				scope::text AS scope,
				reason,
				internal_note,
				starts_at,
				expires_at,
				created_by,
				created_at,
				revoked_at,
				revoked_by,
				(${activeExpression(this.sql)}) AS is_active
			FROM app_user_restrictions
			WHERE
				(${userId}::text IS NOT NULL AND user_id = ${userId})
				OR (${email}::text IS NOT NULL AND email_normalized = ${email})
			ORDER BY is_active DESC, created_at DESC
			LIMIT ${limit}
		`;
		return rows.map(toRestriction);
	}

	async listNoticesForUser(input: {
		userId?: string | null;
		email?: string | null;
		limit?: number;
	}): Promise<UserNotice[]> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return [];
		const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);
		const segmentKeys = await this.getSegmentKeys({ userId, email });
		const rows = await this.sql<NoticeRow[]>`
			SELECT
				notices.id,
				notices.target_type::text AS target_type,
				notices.target_user_id,
				notices.target_email_normalized,
				notices.segment_key,
				notices.title,
				notices.body,
				notices.severity::text AS severity,
				notices.cta_label,
				notices.cta_href,
				notices.requires_ack,
				notices.dismissible,
				notices.starts_at,
				notices.expires_at,
				notices.created_by,
				notices.created_at,
				notices.revoked_at,
				notices.revoked_by,
				notices.internal_note,
				(${activeExpression(this.sql)}) AS is_active,
				COUNT(receipts.id)::int AS delivered_count,
				COUNT(receipts.id) FILTER (WHERE receipts.read_at IS NOT NULL)::int AS read_count,
				COUNT(receipts.id) FILTER (WHERE receipts.dismissed_at IS NOT NULL)::int AS dismissed_count,
				COUNT(receipts.id) FILTER (WHERE receipts.acknowledged_at IS NOT NULL)::int AS acknowledged_count,
				recipient_receipt.read_at AS recipient_read_at,
				recipient_receipt.dismissed_at AS recipient_dismissed_at,
				recipient_receipt.acknowledged_at AS recipient_acknowledged_at
			FROM app_user_notices notices
			LEFT JOIN LATERAL (
				SELECT read_at, dismissed_at, acknowledged_at
				FROM app_user_notice_receipts receipt
				WHERE receipt.notice_id = notices.id
					AND (
						(${userId}::text IS NOT NULL AND receipt.user_id = ${userId})
						OR (${email}::text IS NOT NULL AND receipt.email_normalized = ${email})
					)
				ORDER BY delivered_at DESC
				LIMIT 1
			) recipient_receipt ON TRUE
			LEFT JOIN app_user_notice_receipts receipts
				ON receipts.notice_id = notices.id
			WHERE
				notices.target_type IN ('global', 'authenticated_users')
				OR notices.target_user_id = ${userId}
				OR notices.target_email_normalized = ${email}
				OR (
					${segmentKeys.length > 0}::boolean
					AND notices.target_type = 'segment'
					AND notices.segment_key = ANY(${segmentKeys})
				)
			GROUP BY
				notices.id,
				recipient_receipt.read_at,
				recipient_receipt.dismissed_at,
				recipient_receipt.acknowledged_at
			ORDER BY
				CASE
					WHEN (${activeExpression(this.sql)})
						AND notices.requires_ack = TRUE
						AND recipient_receipt.acknowledged_at IS NULL THEN 0
					WHEN (${activeExpression(this.sql)})
						AND notices.requires_ack = FALSE
						AND notices.dismissible = TRUE
						AND recipient_receipt.dismissed_at IS NULL THEN 1
					WHEN (${activeExpression(this.sql)}) THEN 2
					ELSE 3
				END,
				notices.created_at DESC
			LIMIT ${limit}
		`;
		return rows.map(toNotice);
	}

	async listGlobalNotices(limit = 50): Promise<UserNotice[]> {
		await this.ready();
		const safeLimit = Math.min(Math.max(limit, 1), 100);
		const rows = await this.sql<NoticeRow[]>`
			SELECT
				notices.id,
				notices.target_type::text AS target_type,
				notices.target_user_id,
				notices.target_email_normalized,
				notices.segment_key,
				notices.title,
				notices.body,
				notices.severity::text AS severity,
				notices.cta_label,
				notices.cta_href,
				notices.requires_ack,
				notices.dismissible,
				notices.starts_at,
				notices.expires_at,
				notices.created_by,
				notices.created_at,
				notices.revoked_at,
				notices.revoked_by,
				notices.internal_note,
				(${activeExpression(this.sql)}) AS is_active,
				COUNT(receipts.id)::int AS delivered_count,
				COUNT(receipts.id) FILTER (WHERE receipts.read_at IS NOT NULL)::int AS read_count,
				COUNT(receipts.id) FILTER (WHERE receipts.dismissed_at IS NOT NULL)::int AS dismissed_count,
				COUNT(receipts.id) FILTER (WHERE receipts.acknowledged_at IS NOT NULL)::int AS acknowledged_count
			FROM app_user_notices notices
			LEFT JOIN app_user_notice_receipts receipts
				ON receipts.notice_id = notices.id
			WHERE notices.target_type IN ('global', 'authenticated_users', 'segment')
			GROUP BY notices.id
			ORDER BY is_active DESC, notices.created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map(toNotice);
	}

	async listNoticeReceiptsForUser(input: {
		userId?: string | null;
		email?: string | null;
		limit?: number;
	}): Promise<UserNoticeReceipt[]> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return [];
		const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);
		const rows = await this.sql<NoticeReceiptRow[]>`
			SELECT
				id,
				notice_id,
				user_id,
				email_normalized,
				delivered_at,
				read_at,
				dismissed_at,
				acknowledged_at
			FROM app_user_notice_receipts
			WHERE
				(${userId}::text IS NOT NULL AND user_id = ${userId})
				OR (${email}::text IS NOT NULL AND email_normalized = ${email})
			ORDER BY delivered_at DESC
			LIMIT ${limit}
		`;
		return rows.map(toReceipt);
	}

	async listAdminNotesForUser(input: {
		userId?: string | null;
		email?: string | null;
		limit?: number;
	}): Promise<UserAdminNote[]> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return [];
		const limit = Math.min(Math.max(input.limit ?? 100, 1), 250);
		const rows = await this.sql<AdminNoteRow[]>`
			SELECT
				id,
				user_id,
				email_normalized,
				category::text AS category,
				note,
				created_by,
				created_at
			FROM app_user_admin_notes
			WHERE
				(${userId}::text IS NOT NULL AND user_id = ${userId})
				OR (${email}::text IS NOT NULL AND email_normalized = ${email})
			ORDER BY created_at DESC
			LIMIT ${limit}
		`;
		return rows.map(toAdminNote);
	}

	async listRecentAdminNotes(limit = 12): Promise<UserAdminNote[]> {
		await this.ready();
		const safeLimit = Math.min(Math.max(limit, 1), 40);
		const rows = await this.sql<AdminNoteRow[]>`
			SELECT
				id,
				user_id,
				email_normalized,
				category::text AS category,
				note,
				created_by,
				created_at
			FROM app_user_admin_notes
			ORDER BY created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map(toAdminNote);
	}

	private async getSegmentKeys(input: {
		userId?: string | null;
		email?: string | null;
	}): Promise<string[]> {
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		const segments = new Set<string>();
		if (userId || email) segments.add("all_known_users");
		if (!userId && !email) return [];

		const tableRows = await this.sql<
			Array<{
				ticket_listings_table: string | null;
				ticket_interests_table: string | null;
				submissions_table: string | null;
				plans_table: string | null;
				relationships_table: string | null;
			}>
		>`
			SELECT
				to_regclass('ticket_exchange_listings')::text AS ticket_listings_table,
				to_regclass('ticket_exchange_interests')::text AS ticket_interests_table,
				to_regclass('app_event_submissions')::text AS submissions_table,
				to_regclass('app_user_plans')::text AS plans_table,
				to_regclass('app_user_event_relationships')::text AS relationships_table
		`;
		const tables = tableRows[0];

		if (tables?.ticket_listings_table || tables?.ticket_interests_table) {
			const rows = await this.sql<Array<{ has_activity: boolean }>>`
				SELECT
					${
						tables.ticket_listings_table
							? this.sql`
								EXISTS (
									SELECT 1
									FROM ticket_exchange_listings listings
									WHERE (${userId}::text IS NOT NULL AND listings.owner_user_id = ${userId})
										OR (${email}::text IS NOT NULL AND LOWER(listings.owner_email) = ${email})
								)
							`
							: this.sql`FALSE`
					}
					OR ${
						tables.ticket_interests_table
							? this.sql`
								EXISTS (
									SELECT 1
									FROM ticket_exchange_interests interests
									WHERE (${userId}::text IS NOT NULL AND interests.actor_user_id = ${userId})
										OR (${email}::text IS NOT NULL AND LOWER(interests.actor_email) = ${email})
								)
							`
							: this.sql`FALSE`
					} AS has_activity
			`;
			if (rows[0]?.has_activity) segments.add("ticket_exchange_users");
		}

		if (tables?.submissions_table && email) {
			const rows = await this.sql<Array<{ has_activity: boolean }>>`
				SELECT EXISTS (
					SELECT 1
					FROM app_event_submissions submissions
					WHERE LOWER(submissions.host_email) = ${email}
				) AS has_activity
			`;
			if (rows[0]?.has_activity) segments.add("event_submitters");
		}

		if (tables?.plans_table && userId) {
			const rows = await this.sql<Array<{ has_activity: boolean }>>`
				SELECT EXISTS (
					SELECT 1
					FROM app_user_plans plans
					WHERE plans.user_id = ${userId}
						OR plans.owner_key = ${"user:"} || ${userId}
				) AS has_activity
			`;
			if (rows[0]?.has_activity) segments.add("route_planners");
		}

		if (tables?.relationships_table && userId) {
			const rows = await this.sql<Array<{ has_activity: boolean }>>`
				SELECT EXISTS (
					SELECT 1
					FROM app_user_event_relationships relationships
					WHERE relationships.user_id = ${userId}
						AND relationships.relationship_type = 'saved'
				) AS has_activity
			`;
			if (rows[0]?.has_activity) segments.add("saved_event_users");
		}

		return Array.from(segments);
	}

	async listActivePublicNotices(input: {
		userId?: string | null;
		email?: string | null;
	}): Promise<PublicUserNotice[]> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		const isAuthenticated = Boolean(userId || email);
		const segmentKeys = isAuthenticated
			? await this.getSegmentKeys({ userId, email })
			: [];
		const rows = await this.sql<
			Array<
				NoticeRow & {
					receipt_read_at: Date | string | null;
					receipt_dismissed_at: Date | string | null;
					receipt_acknowledged_at: Date | string | null;
				}
			>
		>`
			SELECT
				notices.id,
				notices.target_type::text AS target_type,
				notices.target_user_id,
				notices.target_email_normalized,
				notices.segment_key,
				notices.title,
				notices.body,
				notices.severity::text AS severity,
				notices.cta_label,
				notices.cta_href,
				notices.requires_ack,
				notices.dismissible,
				notices.starts_at,
				notices.expires_at,
				notices.created_by,
				notices.created_at,
				notices.revoked_at,
				notices.revoked_by,
				notices.internal_note,
				(${activeExpression(this.sql)}) AS is_active,
				receipts.read_at AS receipt_read_at,
				receipts.dismissed_at AS receipt_dismissed_at,
				receipts.acknowledged_at AS receipt_acknowledged_at
			FROM app_user_notices notices
			LEFT JOIN LATERAL (
				SELECT read_at, dismissed_at, acknowledged_at
				FROM app_user_notice_receipts receipts
				WHERE receipts.notice_id = notices.id
					AND (
						(${userId}::text IS NOT NULL AND receipts.user_id = ${userId})
						OR (${email}::text IS NOT NULL AND receipts.email_normalized = ${email})
					)
				ORDER BY delivered_at DESC
				LIMIT 1
			) receipts ON TRUE
			WHERE ${activeExpression(this.sql)}
				AND (
					notices.target_type = 'global'
					OR (${isAuthenticated}::boolean AND notices.target_type = 'authenticated_users')
					OR (${userId}::text IS NOT NULL AND notices.target_user_id = ${userId})
					OR (${email}::text IS NOT NULL AND notices.target_email_normalized = ${email})
					OR (
						${segmentKeys.length > 0}::boolean
						AND notices.target_type = 'segment'
						AND notices.segment_key = ANY(${segmentKeys})
					)
				)
				AND (
					(notices.requires_ack = TRUE AND receipts.acknowledged_at IS NULL)
					OR (notices.requires_ack = FALSE AND receipts.dismissed_at IS NULL)
				)
			ORDER BY
				CASE notices.severity
					WHEN 'critical' THEN 0
					WHEN 'action_required' THEN 1
					WHEN 'warning' THEN 2
					ELSE 3
				END,
				notices.created_at DESC
			LIMIT 8
		`;

		if (isAuthenticated) {
			for (const row of rows) {
				await this.markNoticeDelivered({
					noticeId: row.id,
					userId,
					email,
				});
			}
		}

		return rows.map((row) => ({
			id: row.id,
			title: row.title,
			body: row.body,
			severity: row.severity,
			ctaLabel: row.cta_label,
			ctaHref: row.cta_href,
			requiresAck: row.requires_ack,
			dismissible: row.dismissible,
			expiresAt: toIso(row.expires_at),
			receipt: isAuthenticated
				? {
						readAt: toIso(row.receipt_read_at),
						dismissedAt: toIso(row.receipt_dismissed_at),
						acknowledgedAt: toIso(row.receipt_acknowledged_at),
					}
				: null,
		}));
	}

	async markNoticeDelivered(input: {
		noticeId: string;
		userId?: string | null;
		email?: string | null;
	}): Promise<UserNoticeReceipt | null> {
		await this.ready();
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return null;
		const existingRows = await this.sql<NoticeReceiptRow[]>`
			SELECT
				id,
				notice_id,
				user_id,
				email_normalized,
				delivered_at,
				read_at,
				dismissed_at,
				acknowledged_at
			FROM app_user_notice_receipts
			WHERE notice_id = ${normalizeText(input.noticeId, 100)}
				AND (
					(${userId}::text IS NOT NULL AND user_id = ${userId})
					OR (${email}::text IS NOT NULL AND email_normalized = ${email})
				)
			ORDER BY delivered_at DESC
			LIMIT 1
		`;
		if (existingRows[0]) return toReceipt(existingRows[0]);

		const rows = await this.sql<NoticeReceiptRow[]>`
			INSERT INTO app_user_notice_receipts (
				id,
				notice_id,
				user_id,
				email_normalized
			)
			VALUES (
				${randomUUID()},
				${normalizeText(input.noticeId, 100)},
				${userId},
				${email}
			)
			RETURNING
				id,
				notice_id,
				user_id,
				email_normalized,
				delivered_at,
				read_at,
				dismissed_at,
				acknowledged_at
		`;
		return rows[0] ? toReceipt(rows[0]) : null;
	}

	async markNoticeReceipt(input: {
		noticeId: string;
		userId?: string | null;
		email?: string | null;
		action: "read" | "dismiss" | "acknowledge";
	}): Promise<UserNoticeReceipt | null> {
		await this.ready();
		await this.markNoticeDelivered(input);
		const userId = normalizeUserId(input.userId);
		const email = normalizeEmail(input.email);
		if (!userId && !email) return null;
		const rows = await this.sql<NoticeReceiptRow[]>`
			UPDATE app_user_notice_receipts
			SET
				read_at = CASE
					WHEN ${input.action} IN ('read', 'dismiss', 'acknowledge') THEN COALESCE(read_at, NOW())
					ELSE read_at
				END,
				dismissed_at = CASE
					WHEN ${input.action} = 'dismiss' THEN COALESCE(dismissed_at, NOW())
					ELSE dismissed_at
				END,
				acknowledged_at = CASE
					WHEN ${input.action} = 'acknowledge' THEN COALESCE(acknowledged_at, NOW())
					ELSE acknowledged_at
				END
			WHERE notice_id = ${normalizeText(input.noticeId, 100)}
				AND (
					(${userId}::text IS NOT NULL AND user_id = ${userId})
					OR (${email}::text IS NOT NULL AND email_normalized = ${email})
				)
			RETURNING
				id,
				notice_id,
				user_id,
				email_normalized,
				delivered_at,
				read_at,
				dismissed_at,
				acknowledged_at
		`;
		return rows[0] ? toReceipt(rows[0]) : null;
	}
}

export const getUserPolicyRepository = (): UserPolicyRepository | null => {
	if (
		globalThis.__ooocFeteFinderUserPolicyRepository &&
		globalThis.__ooocFeteFinderUserPolicyRepository instanceof
			UserPolicyRepository
	) {
		return globalThis.__ooocFeteFinderUserPolicyRepository;
	}

	const sql = getPostgresClient();
	if (!sql) return null;

	const repository = new UserPolicyRepository(sql);
	globalThis.__ooocFeteFinderUserPolicyRepository = repository;
	return repository;
};
