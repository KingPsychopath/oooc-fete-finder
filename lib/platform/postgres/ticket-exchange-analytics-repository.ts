import "server-only";

import { isValidUserId } from "@/features/auth/user-id";
import type {
	TicketExchangeAnalyticsAction,
	TicketExchangeAnalyticsSurface,
} from "@/features/ticket-exchange/analytics-events";
import type {
	TicketExchangeListingStatus,
	TicketExchangeListingType,
} from "@/features/ticket-exchange/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocTicketExchangeAnalyticsRepository:
		| TicketExchangeAnalyticsRepository
		| undefined;
}

export interface TicketExchangeAnalyticsRecordInput {
	actionType: TicketExchangeAnalyticsAction;
	sessionId?: string | null;
	userId?: string | null;
	userEmail?: string | null;
	eventKey?: string | null;
	listingId?: string | null;
	listingType?: TicketExchangeListingType | null;
	listingStatus?: TicketExchangeListingStatus | null;
	surface?: TicketExchangeAnalyticsSurface | null;
	detail?: string | null;
	path?: string | null;
	isAuthenticated?: boolean | null;
	deviceClass?: string | null;
	platform?: string | null;
	browserFamily?: string | null;
	timezone?: string | null;
	locale?: string | null;
	recordedAt?: string;
}

type TicketExchangeAnalyticsSummaryRow = {
	exchangeViewCount: number;
	uniqueExchangeViewSessionCount: number;
	eventSelectCount: number;
	eventDetailsOpenCount: number;
	tabChangeCount: number;
	profileOpenCount: number;
	profileSaveCount: number;
	agreementOpenCount: number;
	agreementAcceptCount: number;
	listingFormOpenCount: number;
	listingCreateCount: number;
	contactUnlockCount: number;
	contactLinkClickCount: number;
	listingStatusUpdateCount: number;
	listingRepostCount: number;
	reportOpenCount: number;
	reportSubmitCount: number;
	uniqueActionSessionCount: number;
	uniqueListingCreateSessionCount: number;
	uniqueContactUnlockSessionCount: number;
	uniqueReportSubmitSessionCount: number;
};

type TicketExchangeAnalyticsDailyRow = {
	day: string;
	exchangeViewCount: number;
	listingCreateCount: number;
	contactUnlockCount: number;
	reportSubmitCount: number;
};

type TicketExchangeAnalyticsEventRow = {
	eventKey: string;
	exchangeViewCount: number;
	eventSelectCount: number;
	listingCreateCount: number;
	contactUnlockCount: number;
	reportSubmitCount: number;
	uniqueSessionCount: number;
};

const cleanString = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed.slice(0, maxLength);
};

const sanitizeUserId = (userId: string | null | undefined): string | null => {
	const cleaned = cleanString(userId, 80);
	return cleaned && isValidUserId(cleaned) ? cleaned : null;
};

const toSafeIsoTimestamp = (value?: string): string => {
	if (!value) return new Date().toISOString();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
	return parsed.toISOString();
};

const emptySummary = (): TicketExchangeAnalyticsSummaryRow => ({
	exchangeViewCount: 0,
	uniqueExchangeViewSessionCount: 0,
	eventSelectCount: 0,
	eventDetailsOpenCount: 0,
	tabChangeCount: 0,
	profileOpenCount: 0,
	profileSaveCount: 0,
	agreementOpenCount: 0,
	agreementAcceptCount: 0,
	listingFormOpenCount: 0,
	listingCreateCount: 0,
	contactUnlockCount: 0,
	contactLinkClickCount: 0,
	listingStatusUpdateCount: 0,
	listingRepostCount: 0,
	reportOpenCount: 0,
	reportSubmitCount: 0,
	uniqueActionSessionCount: 0,
	uniqueListingCreateSessionCount: 0,
	uniqueContactUnlockSessionCount: 0,
	uniqueReportSubmitSessionCount: 0,
});

export class TicketExchangeAnalyticsRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS ticket_exchange_analytics_stats (
				id BIGSERIAL PRIMARY KEY,
				action_type TEXT NOT NULL CHECK (action_type IN ('exchange_view', 'event_select', 'event_details_open', 'tab_change', 'profile_open', 'profile_save', 'agreement_open', 'agreement_accept', 'listing_form_open', 'listing_create', 'contact_unlock', 'contact_link_click', 'listing_status_update', 'listing_repost', 'report_open', 'report_submit')),
				session_id TEXT,
				user_id TEXT,
				user_email TEXT,
				event_key TEXT,
				listing_id TEXT,
				listing_type TEXT,
				listing_status TEXT,
				surface TEXT,
				detail TEXT,
				path TEXT,
				is_authenticated BOOLEAN,
				device_class TEXT,
				platform TEXT,
				browser_family TEXT,
				timezone TEXT,
				locale TEXT,
				recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			DO $$
			BEGIN
				ALTER TABLE ticket_exchange_analytics_stats
				DROP CONSTRAINT IF EXISTS ticket_exchange_analytics_stats_action_type_check;
				ALTER TABLE ticket_exchange_analytics_stats
				ADD CONSTRAINT ticket_exchange_analytics_stats_action_type_check
				CHECK (action_type IN ('exchange_view', 'event_select', 'event_details_open', 'tab_change', 'profile_open', 'profile_save', 'agreement_open', 'agreement_accept', 'listing_form_open', 'listing_create', 'contact_unlock', 'contact_link_click', 'listing_status_update', 'listing_repost', 'report_open', 'report_submit'));
			END $$;
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_analytics_time
			ON ticket_exchange_analytics_stats (recorded_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_analytics_action_time
			ON ticket_exchange_analytics_stats (action_type, recorded_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_analytics_event_time
			ON ticket_exchange_analytics_stats (event_key, recorded_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_analytics_session_time
			ON ticket_exchange_analytics_stats (session_id, recorded_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async recordAction(input: TicketExchangeAnalyticsRecordInput): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO ticket_exchange_analytics_stats (
				action_type,
				session_id,
				user_id,
				user_email,
				event_key,
				listing_id,
				listing_type,
				listing_status,
				surface,
				detail,
				path,
				is_authenticated,
				device_class,
				platform,
				browser_family,
				timezone,
				locale,
				recorded_at
			)
			VALUES (
				${input.actionType},
				${cleanString(input.sessionId, 120)},
				${sanitizeUserId(input.userId)},
				${cleanString(input.userEmail, 254)},
				${cleanString(input.eventKey?.toLowerCase(), 220)},
				${cleanString(input.listingId, 120)},
				${cleanString(input.listingType, 20)},
				${cleanString(input.listingStatus, 20)},
				${cleanString(input.surface, 40)},
				${cleanString(input.detail, 160)},
				${cleanString(input.path, 280)},
				${input.isAuthenticated ?? null},
				${cleanString(input.deviceClass, 40)},
				${cleanString(input.platform, 40)},
				${cleanString(input.browserFamily, 40)},
				${cleanString(input.timezone, 80)},
				${cleanString(input.locale, 40)},
				${toSafeIsoTimestamp(input.recordedAt)}
			)
		`;
	}

	async summarizeWindow(input: {
		startAt: string;
		endAt: string;
		includeAuthenticatedOnly?: boolean;
	}): Promise<TicketExchangeAnalyticsSummaryRow> {
		await this.ready();
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		const rows = await this.sql<TicketExchangeAnalyticsSummaryRow[]>`
			SELECT
				COUNT(*) FILTER (WHERE action_type = 'exchange_view')::int AS "exchangeViewCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'exchange_view')::int AS "uniqueExchangeViewSessionCount",
				COUNT(*) FILTER (WHERE action_type = 'event_select')::int AS "eventSelectCount",
				COUNT(*) FILTER (WHERE action_type = 'event_details_open')::int AS "eventDetailsOpenCount",
				COUNT(*) FILTER (WHERE action_type = 'tab_change')::int AS "tabChangeCount",
				COUNT(*) FILTER (WHERE action_type = 'profile_open')::int AS "profileOpenCount",
				COUNT(*) FILTER (WHERE action_type = 'profile_save')::int AS "profileSaveCount",
				COUNT(*) FILTER (WHERE action_type = 'agreement_open')::int AS "agreementOpenCount",
				COUNT(*) FILTER (WHERE action_type = 'agreement_accept')::int AS "agreementAcceptCount",
				COUNT(*) FILTER (WHERE action_type = 'listing_form_open')::int AS "listingFormOpenCount",
				COUNT(*) FILTER (WHERE action_type = 'listing_create')::int AS "listingCreateCount",
				COUNT(*) FILTER (WHERE action_type = 'contact_unlock')::int AS "contactUnlockCount",
				COUNT(*) FILTER (WHERE action_type = 'contact_link_click')::int AS "contactLinkClickCount",
				COUNT(*) FILTER (WHERE action_type = 'listing_status_update')::int AS "listingStatusUpdateCount",
				COUNT(*) FILTER (WHERE action_type = 'listing_repost')::int AS "listingRepostCount",
				COUNT(*) FILTER (WHERE action_type = 'report_open')::int AS "reportOpenCount",
				COUNT(*) FILTER (WHERE action_type = 'report_submit')::int AS "reportSubmitCount",
				COUNT(DISTINCT session_id)::int AS "uniqueActionSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'listing_create')::int AS "uniqueListingCreateSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'contact_unlock')::int AS "uniqueContactUnlockSessionCount",
				COUNT(DISTINCT session_id) FILTER (WHERE action_type = 'report_submit')::int AS "uniqueReportSubmitSessionCount"
			FROM ticket_exchange_analytics_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
		`;
		return rows[0] ?? emptySummary();
	}

	async listDailySeries(input: {
		startAt: string;
		endAt: string;
		includeAuthenticatedOnly?: boolean;
	}): Promise<TicketExchangeAnalyticsDailyRow[]> {
		await this.ready();
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		return this.sql<TicketExchangeAnalyticsDailyRow[]>`
			SELECT
				TO_CHAR(DATE_TRUNC('day', recorded_at), 'YYYY-MM-DD') AS day,
				COUNT(*) FILTER (WHERE action_type = 'exchange_view')::int AS "exchangeViewCount",
				COUNT(*) FILTER (WHERE action_type = 'listing_create')::int AS "listingCreateCount",
				COUNT(*) FILTER (WHERE action_type = 'contact_unlock')::int AS "contactUnlockCount",
				COUNT(*) FILTER (WHERE action_type = 'report_submit')::int AS "reportSubmitCount"
			FROM ticket_exchange_analytics_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
			GROUP BY 1
			ORDER BY 1 ASC
		`;
	}

	async listTopEvents(input: {
		startAt: string;
		endAt: string;
		limit: number;
		includeAuthenticatedOnly?: boolean;
	}): Promise<TicketExchangeAnalyticsEventRow[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		return this.sql<TicketExchangeAnalyticsEventRow[]>`
			SELECT
				event_key AS "eventKey",
				COUNT(*) FILTER (WHERE action_type = 'exchange_view')::int AS "exchangeViewCount",
				COUNT(*) FILTER (WHERE action_type = 'event_select')::int AS "eventSelectCount",
				COUNT(*) FILTER (WHERE action_type = 'listing_create')::int AS "listingCreateCount",
				COUNT(*) FILTER (WHERE action_type = 'contact_unlock')::int AS "contactUnlockCount",
				COUNT(*) FILTER (WHERE action_type = 'report_submit')::int AS "reportSubmitCount",
				COUNT(DISTINCT session_id)::int AS "uniqueSessionCount"
			FROM ticket_exchange_analytics_stats
			WHERE event_key IS NOT NULL
				AND recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
			GROUP BY event_key
			ORDER BY "contactUnlockCount" DESC, "listingCreateCount" DESC, "exchangeViewCount" DESC
			LIMIT ${safeLimit}
		`;
	}

	async listTopActions(input: {
		startAt: string;
		endAt: string;
		limit: number;
		includeAuthenticatedOnly?: boolean;
	}): Promise<Array<{ actionType: string; surface: string; count: number }>> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input.limit, 100));
		const userScopeFilter = input.includeAuthenticatedOnly
			? this.sql`AND user_id IS NOT NULL`
			: this.sql``;
		return this.sql<
			Array<{ actionType: string; surface: string; count: number }>
		>`
			SELECT
				action_type AS "actionType",
				COALESCE(surface, 'unknown') AS surface,
				COUNT(*)::int AS count
			FROM ticket_exchange_analytics_stats
			WHERE recorded_at >= ${input.startAt}
				AND recorded_at < ${input.endAt}
				${userScopeFilter}
			GROUP BY 1, 2
			ORDER BY count DESC
			LIMIT ${safeLimit}
		`;
	}
}

export const getTicketExchangeAnalyticsRepository =
	(): TicketExchangeAnalyticsRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;
		if (!globalThis.__ooocTicketExchangeAnalyticsRepository) {
			globalThis.__ooocTicketExchangeAnalyticsRepository =
				new TicketExchangeAnalyticsRepository(sql);
		}
		return globalThis.__ooocTicketExchangeAnalyticsRepository;
	};
