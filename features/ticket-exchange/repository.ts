import "server-only";

import { generateUserId } from "@/features/auth/user-id";
import type { Sql } from "postgres";
import { getPostgresClient } from "@/lib/platform/postgres/postgres-client";
import {
	filterContactSnapshot,
	getEffectiveListingStatus,
} from "./utils";
import {
	TICKET_EXCHANGE_INTEREST_LOCK_MINUTES,
	TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER,
	TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER,
	TICKET_EXCHANGE_RULES_VERSION,
} from "./constants";
import type {
	TicketExchangeContactMethod,
	TicketExchangeContactProfile,
	TicketExchangeContactSnapshot,
	TicketExchangeAdminDashboard,
	TicketExchangeAdminListing,
	TicketExchangeAdminReport,
	TicketExchangeInterestView,
	TicketExchangeListingStatus,
	TicketExchangeListingType,
	TicketExchangeListingView,
	TicketExchangeReportReason,
	TicketExchangeSummary,
} from "./types";

declare global {
	var __ooocTicketExchangeRepository: TicketExchangeRepository | undefined;
}

type ContactProfileRow = {
	user_id: string;
	account_email: string;
	display_name: string;
	alternate_email: string;
	whatsapp_number: string;
	instagram_handle: string;
	x_handle: string;
	other_contact_url: string;
	rules_accepted_at: string | null;
	rules_version: string | null;
	created_at: string;
	updated_at: string;
};

type ListingRow = {
	id: string;
	event_key: string;
	event_slug: string;
	event_name: string;
	listing_type: TicketExchangeListingType;
	quantity_label: string;
	price_label: string;
	note: string;
	status: TicketExchangeListingStatus;
	owner_user_id: string;
	owner_email: string;
	contact_methods: TicketExchangeContactMethod[];
	contact_snapshot: TicketExchangeContactSnapshot;
	expires_at: string;
	created_at: string;
	updated_at: string;
	resolved_at: string | null;
	interest_count: number;
	report_count?: number;
	bot_announced_at?: string | null;
};

type InterestRow = {
	id: string;
	listing_id: string;
	actor_user_id: string;
	actor_email: string;
	contact_methods: TicketExchangeContactMethod[];
	contact_snapshot: TicketExchangeContactSnapshot;
	created_at: string;
};

type SummaryRow = {
	event_key: string;
	selling_count: number;
	looking_count: number;
	latest_listing_at: string | null;
};

type AdminReportRow = {
	id: string;
	listing_id: string;
	reporter_user_id: string;
	reason: TicketExchangeReportReason;
	details: string;
	created_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
	review_note: string;
	listing_event_name: string;
	listing_type: TicketExchangeListingType;
	quantity_label: string;
	price_label: string;
	status: TicketExchangeListingStatus;
	owner_email: string;
	expires_at: string;
};

type AdminCountsRow = {
	active_selling_count: number;
	active_looking_count: number;
	pending_report_count: number;
	bot_pending_count: number;
	bot_announced_count: number;
	contact_unlock_count: number;
};

type DuplicateListingRow = {
	id: string;
};

const toIso = (value: string | Date | null): string | null => {
	if (!value) return null;
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

const toProfile = (row: ContactProfileRow): TicketExchangeContactProfile => ({
	userId: row.user_id,
	accountEmail: row.account_email,
	displayName: row.display_name,
	alternateEmail: row.alternate_email,
	whatsappNumber: row.whatsapp_number,
	instagramHandle: row.instagram_handle,
	xHandle: row.x_handle,
	rulesAcceptedAt: toIso(row.rules_accepted_at),
	rulesVersion: row.rules_version,
	createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
	updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
});

const toInterest = (row: InterestRow): TicketExchangeInterestView => ({
	id: row.id,
	listingId: row.listing_id,
	actorUserId: row.actor_user_id,
	actorEmail: row.actor_email,
	contactMethods: row.contact_methods ?? [],
	contactSnapshot: row.contact_snapshot,
	createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
});

export class TicketExchangeRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS ticket_exchange_contact_profiles (
				user_id TEXT PRIMARY KEY,
				account_email TEXT NOT NULL,
				display_name TEXT NOT NULL DEFAULT '',
				alternate_email TEXT NOT NULL DEFAULT '',
				whatsapp_number TEXT NOT NULL DEFAULT '',
				instagram_handle TEXT NOT NULL DEFAULT '',
				x_handle TEXT NOT NULL DEFAULT '',
				other_contact_url TEXT NOT NULL DEFAULT '',
				rules_accepted_at TIMESTAMPTZ,
				rules_version TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			ALTER TABLE ticket_exchange_contact_profiles
			ADD COLUMN IF NOT EXISTS rules_version TEXT
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS ticket_exchange_listings (
				id TEXT PRIMARY KEY,
				event_key TEXT NOT NULL,
				event_slug TEXT NOT NULL,
				event_name TEXT NOT NULL,
				listing_type TEXT NOT NULL CHECK (listing_type IN ('selling', 'looking')),
				quantity_label TEXT NOT NULL DEFAULT '',
				price_label TEXT NOT NULL DEFAULT '',
				note TEXT NOT NULL DEFAULT '',
				status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'resolved', 'expired', 'removed')),
				owner_user_id TEXT NOT NULL,
				owner_email TEXT NOT NULL,
				contact_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
				contact_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
				expires_at TIMESTAMPTZ NOT NULL,
				bot_announced_at TIMESTAMPTZ,
				resolved_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS ticket_exchange_interests (
				id TEXT PRIMARY KEY,
				listing_id TEXT NOT NULL REFERENCES ticket_exchange_listings(id) ON DELETE CASCADE,
				actor_user_id TEXT NOT NULL,
				actor_email TEXT NOT NULL,
				contact_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
				contact_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE (listing_id, actor_user_id)
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS ticket_exchange_contact_audit (
				id TEXT PRIMARY KEY,
				listing_id TEXT NOT NULL,
				viewer_user_id TEXT NOT NULL,
				viewed_user_id TEXT NOT NULL,
				reason TEXT NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS ticket_exchange_reports (
				id TEXT PRIMARY KEY,
				listing_id TEXT NOT NULL,
				reporter_user_id TEXT NOT NULL,
				reason TEXT NOT NULL,
				details TEXT NOT NULL DEFAULT '',
				reviewed_at TIMESTAMPTZ,
				reviewed_by TEXT,
				review_note TEXT NOT NULL DEFAULT '',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE (listing_id, reporter_user_id)
			)
		`;

		await this.sql`
			ALTER TABLE ticket_exchange_reports
			ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ
		`;
		await this.sql`
			ALTER TABLE ticket_exchange_reports
			ADD COLUMN IF NOT EXISTS reviewed_by TEXT
		`;
		await this.sql`
			ALTER TABLE ticket_exchange_reports
			ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT ''
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_listings_event
			ON ticket_exchange_listings (event_key, status, expires_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_listings_owner
			ON ticket_exchange_listings (owner_user_id, updated_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_interests_actor
			ON ticket_exchange_interests (actor_user_id, created_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_reports_review
			ON ticket_exchange_reports (reviewed_at, created_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async getContactProfile(
		userId: string,
		accountEmail?: string | null,
	): Promise<TicketExchangeContactProfile | null> {
		await this.ready();
		const rows = await this.sql<ContactProfileRow[]>`
			SELECT
				user_id,
				account_email,
				display_name,
				alternate_email,
				whatsapp_number,
				instagram_handle,
				x_handle,
				other_contact_url,
				rules_accepted_at,
				rules_version,
				created_at,
				updated_at
			FROM ticket_exchange_contact_profiles
			WHERE user_id = ${userId}
			LIMIT 1
		`;
		const profile = rows[0] ? toProfile(rows[0]) : null;
		if (profile || !accountEmail) return profile;
		return {
			userId,
			accountEmail,
			displayName: "",
			alternateEmail: "",
			whatsappNumber: "",
			instagramHandle: "",
			xHandle: "",
			rulesAcceptedAt: null,
			rulesVersion: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	}

	async upsertContactProfile(input: {
		userId: string;
		accountEmail: string;
		displayName: string;
		alternateEmail: string;
		whatsappNumber: string;
		instagramHandle: string;
		xHandle: string;
		acceptRules: boolean;
	}): Promise<TicketExchangeContactProfile> {
		await this.ready();
		const rows = await this.sql<ContactProfileRow[]>`
			INSERT INTO ticket_exchange_contact_profiles (
				user_id,
				account_email,
				display_name,
				alternate_email,
				whatsapp_number,
				instagram_handle,
				x_handle,
				other_contact_url,
				rules_accepted_at,
				rules_version,
				updated_at
			)
			VALUES (
				${input.userId},
				${input.accountEmail},
				${input.displayName},
				${input.alternateEmail},
				${input.whatsappNumber},
				${input.instagramHandle},
				${input.xHandle},
				'',
				${input.acceptRules ? new Date().toISOString() : null},
				${input.acceptRules ? TICKET_EXCHANGE_RULES_VERSION : null},
				NOW()
			)
			ON CONFLICT (user_id)
			DO UPDATE SET
				account_email = EXCLUDED.account_email,
				display_name = EXCLUDED.display_name,
				alternate_email = EXCLUDED.alternate_email,
				whatsapp_number = EXCLUDED.whatsapp_number,
				instagram_handle = EXCLUDED.instagram_handle,
				x_handle = EXCLUDED.x_handle,
				other_contact_url = EXCLUDED.other_contact_url,
				rules_accepted_at = CASE
					WHEN EXCLUDED.rules_accepted_at IS NULL THEN ticket_exchange_contact_profiles.rules_accepted_at
					WHEN ticket_exchange_contact_profiles.rules_version = EXCLUDED.rules_version THEN ticket_exchange_contact_profiles.rules_accepted_at
					ELSE EXCLUDED.rules_accepted_at
				END,
				rules_version = COALESCE(EXCLUDED.rules_version, ticket_exchange_contact_profiles.rules_version),
				updated_at = NOW()
			RETURNING
				user_id,
				account_email,
				display_name,
				alternate_email,
				whatsapp_number,
				instagram_handle,
				x_handle,
				other_contact_url,
				rules_accepted_at,
				rules_version,
				created_at,
				updated_at
		`;
		return toProfile(rows[0]);
	}

	async createListing(input: {
		eventKey: string;
		eventSlug: string;
		eventName: string;
		listingType: TicketExchangeListingType;
		quantityLabel: string;
		priceLabel: string;
		note: string;
		ownerUserId: string;
		ownerEmail: string;
		contactMethods: TicketExchangeContactMethod[];
		contactSnapshot: TicketExchangeContactSnapshot;
		expiresAt: Date;
	}): Promise<string> {
		await this.ready();
		const id = generateUserId();
		const duplicates = await this.sql<DuplicateListingRow[]>`
			SELECT id
			FROM ticket_exchange_listings
			WHERE owner_user_id = ${input.ownerUserId}
				AND event_key = ${input.eventKey}
				AND listing_type = ${input.listingType}
				AND quantity_label = ${input.quantityLabel}
				AND price_label = ${input.priceLabel}
				AND note = ${input.note}
				AND status IN ('active', 'paused')
				AND expires_at > NOW()
				AND created_at > NOW() - INTERVAL '2 minutes'
			ORDER BY created_at DESC
			LIMIT 1
		`;
		if (duplicates[0]?.id) return duplicates[0].id;
		await this.sql`
			INSERT INTO ticket_exchange_listings (
				id,
				event_key,
				event_slug,
				event_name,
				listing_type,
				quantity_label,
				price_label,
				note,
				owner_user_id,
				owner_email,
				contact_methods,
				contact_snapshot,
				expires_at
			)
			VALUES (
				${id},
				${input.eventKey},
				${input.eventSlug},
				${input.eventName},
				${input.listingType},
				${input.quantityLabel},
				${input.priceLabel},
				${input.note},
				${input.ownerUserId},
				${input.ownerEmail},
				${this.sql.json(input.contactMethods)},
				${this.sql.json({ ...input.contactSnapshot })},
				${input.expiresAt.toISOString()}
			)
		`;
		return id;
	}

	async listListings(input: {
		userId?: string | null;
		eventKey?: string | null;
		limit?: number;
	}): Promise<TicketExchangeListingView[]> {
		await this.ready();
		const userId = input.userId ?? "";
		const eventKey = input.eventKey?.trim() || null;
		const limit = Math.min(200, Math.max(1, input.limit ?? 80));
		const rows = await this.sql<ListingRow[]>`
			SELECT
				listings.id,
				listings.event_key,
				listings.event_slug,
				listings.event_name,
				listings.listing_type::text AS listing_type,
				listings.quantity_label,
				listings.price_label,
				listings.note,
				listings.status::text AS status,
				listings.owner_user_id,
				listings.owner_email,
				listings.contact_methods,
				listings.contact_snapshot,
				listings.expires_at,
				listings.created_at,
				listings.updated_at,
				listings.resolved_at,
				COUNT(interests.id)::int AS interest_count
			FROM ticket_exchange_listings listings
			LEFT JOIN ticket_exchange_interests interests
				ON interests.listing_id = listings.id
			WHERE listings.status <> 'removed'
				AND (${eventKey}::text IS NULL OR listings.event_key = ${eventKey})
				AND (
					(listings.status IN ('active', 'paused') AND listings.expires_at > NOW())
					OR listings.owner_user_id = ${userId}
					OR EXISTS (
						SELECT 1
						FROM ticket_exchange_interests mine
						WHERE mine.listing_id = listings.id
							AND mine.actor_user_id = ${userId}
					)
				)
			GROUP BY listings.id
			ORDER BY
				CASE
					WHEN listings.status = 'active' AND listings.expires_at > NOW() THEN 0
					WHEN listings.status = 'paused' AND listings.expires_at > NOW() THEN 1
					ELSE 2
				END,
				listings.updated_at DESC
			LIMIT ${limit}
		`;

		const listingIds = rows.map((row) => row.id);
		const interests =
			listingIds.length > 0
				? await this.sql<InterestRow[]>`
					SELECT
						id,
						listing_id,
						actor_user_id,
						actor_email,
						contact_methods,
						contact_snapshot,
						created_at
					FROM ticket_exchange_interests
					WHERE listing_id = ANY(${listingIds})
					ORDER BY created_at DESC
				`
				: [];
		const interestsByListing = new Map<string, TicketExchangeInterestView[]>();
		for (const row of interests) {
			const next = toInterest(row);
			const existing = interestsByListing.get(next.listingId) ?? [];
			existing.push(next);
			interestsByListing.set(next.listingId, existing);
		}

		return rows.map((row) => {
			const rowInterests = interestsByListing.get(row.id) ?? [];
			const isOwner = row.owner_user_id === userId;
			const myInterest =
				rowInterests.find((interest) => interest.actorUserId === userId) ??
				null;
			const maySeeOwnerContact = isOwner || Boolean(myInterest);
			return {
				id: row.id,
				eventKey: row.event_key,
				eventSlug: row.event_slug,
				eventName: row.event_name,
				listingType: row.listing_type,
				quantityLabel: row.quantity_label,
				priceLabel: row.price_label,
				note: row.note,
				status: row.status,
				effectiveStatus: getEffectiveListingStatus({
					status: row.status,
					expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
				}),
				ownerUserId: row.owner_user_id,
				ownerEmail: row.owner_email,
				contactMethods: row.contact_methods ?? [],
				contactSnapshot: maySeeOwnerContact
					? filterContactSnapshot(
							row.contact_snapshot,
							row.contact_methods ?? [],
						)
					: undefined,
				expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
				createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
				updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
				resolvedAt: toIso(row.resolved_at),
				interestCount: row.interest_count,
				isOwner,
				myInterest,
				interests: isOwner ? rowInterests : [],
			};
		});
	}

	async expressInterest(input: {
		listingId: string;
		actorUserId: string;
		actorEmail: string;
		contactMethods: TicketExchangeContactMethod[];
		contactSnapshot: TicketExchangeContactSnapshot;
	}): Promise<void> {
		await this.ready();
		await this.sql.begin(async (transactionSql) => {
			const lockedSql = transactionSql as unknown as Sql;
			await lockedSql`
				SELECT pg_advisory_xact_lock(hashtext('ticket_exchange_interest'), hashtext(${input.actorUserId}))
			`;

			const rows = await lockedSql<
				Array<{ owner_user_id: string; status: string; expires_at: string }>
			>`
				SELECT owner_user_id, status, expires_at
				FROM ticket_exchange_listings
				WHERE id = ${input.listingId}
					AND status = 'active'
					AND expires_at > NOW()
				LIMIT 1
				FOR UPDATE
			`;
			const listing = rows[0];
			if (!listing) {
				throw new Error("This listing is not accepting interest right now.");
			}
			if (listing.owner_user_id === input.actorUserId) {
				throw new Error("You cannot register interest in your own listing.");
			}

			const existingInterestRows = await lockedSql<Array<{ id: string }>>`
				SELECT id
				FROM ticket_exchange_interests
				WHERE listing_id = ${input.listingId}
					AND actor_user_id = ${input.actorUserId}
				LIMIT 1
				FOR UPDATE
			`;
			const isNewUnlock = existingInterestRows.length === 0;

			if (isNewUnlock) {
				const activeInterestRows = await lockedSql<Array<{ count: number }>>`
					SELECT COUNT(DISTINCT interests.listing_id)::int AS count
					FROM ticket_exchange_interests interests
					INNER JOIN ticket_exchange_listings listings
						ON listings.id = interests.listing_id
					WHERE interests.actor_user_id = ${input.actorUserId}
						AND (
							(listings.status = 'active' AND listings.expires_at > NOW())
							OR interests.created_at > NOW() - (${TICKET_EXCHANGE_INTEREST_LOCK_MINUTES} * INTERVAL '1 minute')
						)
				`;
				const activeInterestCount = activeInterestRows[0]?.count ?? 0;
				if (
					activeInterestCount >= TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER
				) {
					throw new Error(
						`You can have interest open on up to ${TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER} active listings at once. Slots unlock after listings close or after ${TICKET_EXCHANGE_INTEREST_LOCK_MINUTES} minutes for closed listings.`,
					);
				}

				const dailyUnlockRows = await lockedSql<Array<{ count: number }>>`
					SELECT COUNT(DISTINCT listing_id)::int AS count
					FROM ticket_exchange_interests
					WHERE actor_user_id = ${input.actorUserId}
						AND created_at > NOW() - INTERVAL '24 hours'
				`;
				const dailyUnlockCount = dailyUnlockRows[0]?.count ?? 0;
				if (dailyUnlockCount >= TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER) {
					throw new Error(
						`You can unlock contact on up to ${TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER} new listings in 24 hours.`,
					);
				}
			}

			await lockedSql`
				INSERT INTO ticket_exchange_interests (
					id,
					listing_id,
					actor_user_id,
					actor_email,
					contact_methods,
					contact_snapshot
				)
				VALUES (
					${generateUserId()},
					${input.listingId},
					${input.actorUserId},
					${input.actorEmail},
					${lockedSql.json(input.contactMethods)},
					${lockedSql.json({ ...input.contactSnapshot })}
				)
				ON CONFLICT (listing_id, actor_user_id)
				DO UPDATE SET
					actor_email = EXCLUDED.actor_email,
					contact_methods = EXCLUDED.contact_methods,
					contact_snapshot = EXCLUDED.contact_snapshot
			`;

			if (isNewUnlock) {
				await lockedSql`
					INSERT INTO ticket_exchange_contact_audit (
						id,
						listing_id,
						viewer_user_id,
						viewed_user_id,
						reason
					)
					VALUES
						(${generateUserId()}, ${input.listingId}, ${input.actorUserId}, ${listing.owner_user_id}, 'interest_owner_reveal'),
						(${generateUserId()}, ${input.listingId}, ${listing.owner_user_id}, ${input.actorUserId}, 'interest_actor_reveal')
				`;
			}
		});
	}

	async updateListingStatus(input: {
		listingId: string;
		ownerUserId: string;
		status: Exclude<TicketExchangeListingStatus, "expired">;
	}): Promise<void> {
		await this.ready();
		await this.sql`
			UPDATE ticket_exchange_listings
			SET
				status = ${input.status},
				resolved_at = CASE WHEN ${input.status} = 'resolved' THEN NOW() ELSE resolved_at END,
				updated_at = NOW()
			WHERE id = ${input.listingId}
				AND owner_user_id = ${input.ownerUserId}
		`;
	}

	async repostListing(input: {
		listingId: string;
		ownerUserId: string;
		quantityLabel: string;
		expiresAt: Date;
	}): Promise<string | null> {
		await this.ready();
		const rows = await this.sql<ListingRow[]>`
			SELECT
				id,
				event_key,
				event_slug,
				event_name,
				listing_type::text AS listing_type,
				quantity_label,
				price_label,
				note,
				status::text AS status,
				owner_user_id,
				owner_email,
				contact_methods,
				contact_snapshot,
				expires_at,
				created_at,
				updated_at,
				resolved_at,
				0::int AS interest_count
			FROM ticket_exchange_listings
			WHERE id = ${input.listingId}
				AND owner_user_id = ${input.ownerUserId}
			LIMIT 1
		`;
		const source = rows[0];
		if (!source) return null;
		await this.updateListingStatus({
			listingId: source.id,
			ownerUserId: input.ownerUserId,
			status: "resolved",
		});
		return this.createListing({
			eventKey: source.event_key,
			eventSlug: source.event_slug,
			eventName: source.event_name,
			listingType: source.listing_type,
			quantityLabel: input.quantityLabel,
			priceLabel: source.price_label,
			note: source.note,
			ownerUserId: source.owner_user_id,
			ownerEmail: source.owner_email,
			contactMethods: source.contact_methods ?? [],
			contactSnapshot: source.contact_snapshot,
			expiresAt: input.expiresAt,
		});
	}

	async reportListing(input: {
		listingId: string;
		reporterUserId: string;
		reason: TicketExchangeReportReason;
		details: string;
	}): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO ticket_exchange_reports (
				id,
				listing_id,
				reporter_user_id,
				reason,
				details
			)
			VALUES (
				${generateUserId()},
				${input.listingId},
				${input.reporterUserId},
				${input.reason},
				${input.details}
			)
			ON CONFLICT (listing_id, reporter_user_id)
			DO UPDATE SET
				reason = EXCLUDED.reason,
				details = EXCLUDED.details,
				created_at = NOW()
		`;
	}

	async getSummaries(eventKeys?: string[]): Promise<TicketExchangeSummary[]> {
		await this.ready();
		const hasEventKeys = Boolean(eventKeys?.length);
		const rows = await this.sql<SummaryRow[]>`
			SELECT
				event_key,
				COUNT(*) FILTER (WHERE listing_type = 'selling')::int AS selling_count,
				COUNT(*) FILTER (WHERE listing_type = 'looking')::int AS looking_count,
				MAX(created_at) AS latest_listing_at
			FROM ticket_exchange_listings
			WHERE status = 'active'
				AND expires_at > NOW()
				AND (${hasEventKeys} = false OR event_key = ANY(${eventKeys ?? []}))
			GROUP BY event_key
		`;
		return rows.map((row) => ({
			eventKey: row.event_key,
			sellingCount: row.selling_count,
			lookingCount: row.looking_count,
			latestListingAt: toIso(row.latest_listing_at),
		}));
	}

	async getRecentListingsForBot(limit = 10): Promise<TicketExchangeListingView[]> {
		await this.ready();
		const safeLimit = Math.min(20, Math.max(1, limit));
		const rows = await this.sql<ListingRow[]>`
			SELECT
				listings.id,
				listings.event_key,
				listings.event_slug,
				listings.event_name,
				listings.listing_type::text AS listing_type,
				listings.quantity_label,
				listings.price_label,
				listings.note,
				listings.status::text AS status,
				listings.owner_user_id,
				listings.owner_email,
				'[]'::jsonb AS contact_methods,
				'{}'::jsonb AS contact_snapshot,
				listings.expires_at,
				listings.created_at,
				listings.updated_at,
				listings.resolved_at,
				0::int AS interest_count
			FROM ticket_exchange_listings listings
			WHERE listings.status = 'active'
				AND listings.expires_at > NOW()
				AND listings.bot_announced_at IS NULL
			ORDER BY listings.created_at ASC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			id: row.id,
			eventKey: row.event_key,
			eventSlug: row.event_slug,
			eventName: row.event_name,
			listingType: row.listing_type,
			quantityLabel: row.quantity_label,
			priceLabel: row.price_label,
			note: row.note,
			status: row.status,
			effectiveStatus: getEffectiveListingStatus({
				status: row.status,
				expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
			}),
			ownerUserId: row.owner_user_id,
			ownerEmail: "",
			contactMethods: [],
			contactSnapshot: undefined,
			expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
			createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
			updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
			resolvedAt: toIso(row.resolved_at),
			interestCount: 0,
			isOwner: false,
			myInterest: null,
			interests: [],
		}));
	}

	async markBotAnnouncement(input: {
		listingId: string;
	}): Promise<void> {
		await this.ready();
		await this.sql`
			UPDATE ticket_exchange_listings
			SET bot_announced_at = NOW()
			WHERE id = ${input.listingId}
				AND status = 'active'
				AND expires_at > NOW()
		`;
	}

	async isListingAnnounceableForBot(input: {
		listingId: string;
	}): Promise<boolean> {
		await this.ready();
		const rows = await this.sql<Array<{ id: string }>>`
			SELECT id
			FROM ticket_exchange_listings
			WHERE id = ${input.listingId}
				AND status = 'active'
				AND expires_at > NOW()
				AND bot_announced_at IS NULL
			LIMIT 1
		`;
		return Boolean(rows[0]);
	}

	async getAdminDashboard(limit = 40): Promise<TicketExchangeAdminDashboard> {
		await this.ready();
		const safeLimit = Math.min(100, Math.max(1, limit));
		const [counts] = await this.sql<AdminCountsRow[]>`
			SELECT
				COUNT(*) FILTER (
					WHERE listing_type = 'selling'
						AND status = 'active'
						AND expires_at > NOW()
				)::int AS active_selling_count,
				COUNT(*) FILTER (
					WHERE listing_type = 'looking'
						AND status = 'active'
						AND expires_at > NOW()
				)::int AS active_looking_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_reports
					WHERE reviewed_at IS NULL
				) AS pending_report_count,
				COUNT(*) FILTER (
					WHERE status = 'active'
						AND expires_at > NOW()
						AND bot_announced_at IS NULL
				)::int AS bot_pending_count,
				COUNT(*) FILTER (
					WHERE bot_announced_at IS NOT NULL
				)::int AS bot_announced_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_contact_audit
				) AS contact_unlock_count
			FROM ticket_exchange_listings
		`;
		const recentListings = await this.getAdminListings(safeLimit);
		const recentReports = await this.getAdminReports(safeLimit);
		return {
			activeSellingCount: counts?.active_selling_count ?? 0,
			activeLookingCount: counts?.active_looking_count ?? 0,
			pendingReportCount: counts?.pending_report_count ?? 0,
			botPendingCount: counts?.bot_pending_count ?? 0,
			botAnnouncedCount: counts?.bot_announced_count ?? 0,
			contactUnlockCount: counts?.contact_unlock_count ?? 0,
			recentListings,
			recentReports,
		};
	}

	async getAdminListings(limit = 40): Promise<TicketExchangeAdminListing[]> {
		await this.ready();
		const safeLimit = Math.min(100, Math.max(1, limit));
		const rows = await this.sql<ListingRow[]>`
			SELECT
				listings.id,
				listings.event_key,
				listings.event_slug,
				listings.event_name,
				listings.listing_type::text AS listing_type,
				listings.quantity_label,
				listings.price_label,
				listings.note,
				listings.status::text AS status,
				listings.owner_user_id,
				listings.owner_email,
				listings.contact_methods,
				listings.contact_snapshot,
				listings.expires_at,
				listings.bot_announced_at,
				listings.created_at,
				listings.updated_at,
				listings.resolved_at,
				COUNT(DISTINCT interests.id)::int AS interest_count,
				COUNT(DISTINCT reports.id)::int AS report_count
			FROM ticket_exchange_listings listings
			LEFT JOIN ticket_exchange_interests interests
				ON interests.listing_id = listings.id
			LEFT JOIN ticket_exchange_reports reports
				ON reports.listing_id = listings.id
			GROUP BY listings.id
			ORDER BY listings.updated_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			id: row.id,
			eventKey: row.event_key,
			eventSlug: row.event_slug,
			eventName: row.event_name,
			listingType: row.listing_type,
			quantityLabel: row.quantity_label,
			priceLabel: row.price_label,
			note: row.note,
			status: row.status,
			effectiveStatus: getEffectiveListingStatus({
				status: row.status,
				expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
			}),
			ownerUserId: row.owner_user_id,
			ownerEmail: row.owner_email,
			contactMethods: row.contact_methods ?? [],
			expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
			createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
			updatedAt: toIso(row.updated_at) ?? new Date(0).toISOString(),
			resolvedAt: toIso(row.resolved_at),
			interestCount: row.interest_count,
			reportCount: row.report_count ?? 0,
			botAnnouncedAt: toIso(row.bot_announced_at ?? null),
		}));
	}

	async getAdminReports(limit = 40): Promise<TicketExchangeAdminReport[]> {
		await this.ready();
		const safeLimit = Math.min(100, Math.max(1, limit));
		const rows = await this.sql<AdminReportRow[]>`
			SELECT
				reports.id,
				reports.listing_id,
				reports.reporter_user_id,
				reports.reason::text AS reason,
				reports.details,
				reports.created_at,
				reports.reviewed_at,
				reports.reviewed_by,
				reports.review_note,
				COALESCE(listings.event_name, 'Removed listing') AS listing_event_name,
				COALESCE(listings.listing_type::text, 'selling') AS listing_type,
				COALESCE(listings.quantity_label, '') AS quantity_label,
				COALESCE(listings.price_label, '') AS price_label,
				COALESCE(listings.status::text, 'removed') AS status,
				COALESCE(listings.owner_email, '') AS owner_email,
				COALESCE(listings.expires_at, reports.created_at) AS expires_at
			FROM ticket_exchange_reports reports
			LEFT JOIN ticket_exchange_listings listings
				ON listings.id = reports.listing_id
			ORDER BY
				CASE WHEN reports.reviewed_at IS NULL THEN 0 ELSE 1 END,
				reports.created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			id: row.id,
			listingId: row.listing_id,
			reporterUserId: row.reporter_user_id,
			reason: row.reason,
			details: row.details,
			createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
			reviewedAt: toIso(row.reviewed_at),
			reviewedBy: row.reviewed_by,
			reviewNote: row.review_note,
			listing: {
				id: row.listing_id,
				eventName: row.listing_event_name,
				listingType: row.listing_type,
				quantityLabel: row.quantity_label,
				priceLabel: row.price_label,
				status: row.status,
				effectiveStatus: getEffectiveListingStatus({
					status: row.status,
					expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
				}),
				ownerEmail: row.owner_email,
			},
		}));
	}

	async updateListingStatusAsAdmin(input: {
		listingId: string;
		status: Exclude<TicketExchangeListingStatus, "expired">;
	}): Promise<void> {
		await this.ready();
		await this.sql`
			UPDATE ticket_exchange_listings
			SET
				status = ${input.status},
				resolved_at = CASE WHEN ${input.status} = 'resolved' THEN NOW() ELSE resolved_at END,
				updated_at = NOW()
			WHERE id = ${input.listingId}
		`;
	}

	async reviewReportAsAdmin(input: {
		reportId: string;
		reviewedBy: string;
		reviewNote: string;
	}): Promise<void> {
		await this.ready();
		await this.sql`
			UPDATE ticket_exchange_reports
			SET
				reviewed_at = NOW(),
				reviewed_by = ${input.reviewedBy},
				review_note = ${input.reviewNote}
			WHERE id = ${input.reportId}
		`;
	}
}

export const getTicketExchangeRepository =
	(): TicketExchangeRepository | null => {
		if (
			globalThis.__ooocTicketExchangeRepository &&
			globalThis.__ooocTicketExchangeRepository instanceof
				TicketExchangeRepository
		) {
			return globalThis.__ooocTicketExchangeRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new TicketExchangeRepository(sql);
		globalThis.__ooocTicketExchangeRepository = repository;
		return repository;
	};
