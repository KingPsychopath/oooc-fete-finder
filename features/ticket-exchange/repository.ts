import "server-only";

import { generateUserId } from "@/features/auth/user-id";
import { getPostgresClient } from "@/lib/platform/postgres/postgres-client";
import type { Sql } from "postgres";
import {
	TICKET_EXCHANGE_INTEREST_LOCK_MINUTES,
	TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER,
	TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER,
	TICKET_EXCHANGE_PUBLIC_RESOLVED_TOMBSTONE_MINUTES,
	TICKET_EXCHANGE_RULES_VERSION,
} from "./constants";
import {
	type TicketExchangePriceBasis,
	type TicketExchangePriceCurrency,
	type TicketExchangePriceSource,
	parseTicketExchangePriceLabel,
} from "./pricing";
import type {
	TicketExchangeAdminDashboard,
	TicketExchangeAdminEventStats,
	TicketExchangeAdminListing,
	TicketExchangeAdminReport,
	TicketExchangeAdminStatsWindow,
	TicketExchangeAdminUnlockWatch,
	TicketExchangeContactMethod,
	TicketExchangeContactProfile,
	TicketExchangeContactSnapshot,
	TicketExchangeInterestView,
	TicketExchangeListingStatus,
	TicketExchangeListingType,
	TicketExchangeListingView,
	TicketExchangeReportReason,
	TicketExchangeSummary,
} from "./types";
import {
	buildContactSnapshot,
	filterContactSnapshot,
	getEffectiveListingStatus,
} from "./utils";

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
	price_amount_minor: number | null;
	price_currency: TicketExchangePriceCurrency | null;
	price_basis: TicketExchangePriceBasis | null;
	price_source: TicketExchangePriceSource | null;
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
	reporter_email: string | null;
	reporter_first_name: string | null;
	reporter_last_name: string | null;
	reason: TicketExchangeReportReason;
	details: string;
	created_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
	review_note: string;
	listing_event_key: string;
	listing_event_slug: string;
	listing_event_name: string;
	listing_type: TicketExchangeListingType;
	quantity_label: string;
	price_label: string;
	price_amount_minor: number | null;
	price_currency: TicketExchangePriceCurrency | null;
	price_basis: TicketExchangePriceBasis | null;
	price_source: TicketExchangePriceSource | null;
	status: TicketExchangeListingStatus;
	owner_user_id: string;
	owner_email: string;
	owner_profile_email: string | null;
	owner_first_name: string | null;
	owner_last_name: string | null;
	expires_at: string;
};

type ReportCreateRow = {
	id: string;
	listing_id: string;
	created_at: string;
	listing_event_key: string | null;
	listing_event_name: string | null;
	owner_user_id: string | null;
	owner_email: string | null;
};

type AdminCountsRow = {
	active_selling_count: number;
	active_looking_count: number;
	pending_report_count: number;
	bot_pending_count: number;
	bot_announced_count: number;
	contact_unlock_count: number;
};

type AdminStatsWindowRow = {
	listing_create_count: number;
	selling_listing_create_count: number;
	looking_listing_create_count: number;
	unique_listing_owner_count: number;
	interest_create_count: number;
	unique_interested_user_count: number;
	report_create_count: number;
	unique_reported_listing_count: number;
	resolved_listing_count: number;
	removed_listing_count: number;
	active_selling_count: number;
	active_looking_count: number;
	pending_report_count: number;
	bot_pending_count: number;
	bot_announced_count: number;
	contact_unlock_count: number;
};

type AdminEventStatsWindowRow = {
	event_key: string;
	event_name: string;
	listing_create_count: number;
	selling_listing_create_count: number;
	looking_listing_create_count: number;
	interest_create_count: number;
	report_create_count: number;
	resolved_listing_count: number;
};

type AdminUnlockWatchRow = {
	actor_user_id: string;
	actor_email: string;
	active_or_locked_count: number;
	daily_unlock_count: number;
	latest_unlock_at: string;
};

type NotificationSummaryRow = {
	count: number;
	oldest_created_at: string | null;
	newest_created_at: string | null;
};

type DuplicateListingRow = {
	id: string;
};

type ContactSnapshotSyncRow = {
	id: string;
	contact_methods: TicketExchangeContactMethod[];
};

type PriceBackfillRow = {
	id: string;
	price_label: string;
	price_amount_minor: number | null;
	price_currency: TicketExchangePriceCurrency | null;
	price_basis: TicketExchangePriceBasis | null;
	price_source: TicketExchangePriceSource | null;
};

const toIso = (value: string | Date | null): string | null => {
	if (!value) return null;
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

const getRowPrice = (
	row: Pick<
		ListingRow,
		| "price_label"
		| "price_amount_minor"
		| "price_currency"
		| "price_basis"
		| "price_source"
	>,
) => {
	const parsed = parseTicketExchangePriceLabel(row.price_label);
	return {
		priceAmountMinor: row.price_amount_minor ?? parsed.amountMinor,
		priceCurrency: row.price_currency ?? parsed.currency,
		priceBasis: row.price_basis ?? parsed.basis,
		priceSource:
			row.price_source ?? (parsed.isFaceValue ? "face_value" : "user"),
	};
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
				price_amount_minor INTEGER,
				price_currency TEXT CHECK (price_currency IS NULL OR price_currency IN ('GBP', 'EUR', 'USD')),
				price_basis TEXT NOT NULL DEFAULT 'unknown' CHECK (price_basis IN ('per_ticket', 'total', 'unknown')),
				price_source TEXT NOT NULL DEFAULT 'user' CHECK (price_source IN ('user', 'suggested_event_price', 'face_value')),
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
			ALTER TABLE ticket_exchange_listings
			ADD COLUMN IF NOT EXISTS price_amount_minor INTEGER
		`;
		await this.sql`
			ALTER TABLE ticket_exchange_listings
			ADD COLUMN IF NOT EXISTS price_currency TEXT
		`;
		await this.sql`
			ALTER TABLE ticket_exchange_listings
			ADD COLUMN IF NOT EXISTS price_basis TEXT NOT NULL DEFAULT 'unknown'
		`;
		await this.sql`
			ALTER TABLE ticket_exchange_listings
			ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'user'
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_listings_event
			ON ticket_exchange_listings (event_key, status, expires_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_listings_marketplace
			ON ticket_exchange_listings (status, expires_at DESC, updated_at DESC)
			WHERE status <> 'removed'
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_listings_owner
			ON ticket_exchange_listings (owner_user_id, updated_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_listings_updated
			ON ticket_exchange_listings (updated_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_interests_actor
			ON ticket_exchange_interests (actor_user_id, created_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_interests_listing_created
			ON ticket_exchange_interests (listing_id, created_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_ticket_exchange_reports_review
			ON ticket_exchange_reports (reviewed_at, created_at DESC)
		`;

		await this.backfillStructuredPrices();
	}

	private async backfillStructuredPrices(): Promise<void> {
		const rows = await this.sql<PriceBackfillRow[]>`
			SELECT
				id,
				price_label,
				price_amount_minor,
				price_currency::text AS price_currency,
				price_basis::text AS price_basis,
				price_source::text AS price_source
			FROM ticket_exchange_listings
			WHERE price_label <> ''
				AND (
					price_amount_minor IS NULL
					OR price_currency IS NULL
					OR price_basis IS NULL
					OR price_source IS NULL
					OR price_source = 'user'
				)
			ORDER BY created_at DESC
			LIMIT 1000
		`;

		await Promise.all(
			rows.map((row) => {
				const parsed = parseTicketExchangePriceLabel(row.price_label);
				const nextSource = parsed.isFaceValue
					? "face_value"
					: (row.price_source ?? "user");
				return this.sql`
					UPDATE ticket_exchange_listings
					SET
						price_amount_minor = COALESCE(price_amount_minor, ${parsed.amountMinor}),
						price_currency = COALESCE(price_currency, ${parsed.currency}),
						price_basis = COALESCE(price_basis, ${parsed.basis}),
						price_source = ${nextSource}
					WHERE id = ${row.id}
				`;
			}),
		);
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
		const profile = toProfile(rows[0]);
		await this.syncVisibleContactSnapshotsForUser(profile);
		return profile;
	}

	private async syncVisibleContactSnapshotsForUser(
		profile: TicketExchangeContactProfile,
	): Promise<void> {
		const snapshot = buildContactSnapshot(profile);
		const [listingRows, interestRows] = await Promise.all([
			this.sql<ContactSnapshotSyncRow[]>`
				SELECT id, contact_methods
				FROM ticket_exchange_listings
				WHERE owner_user_id = ${profile.userId}
					AND status <> 'removed'
			`,
			this.sql<ContactSnapshotSyncRow[]>`
				SELECT id, contact_methods
				FROM ticket_exchange_interests
				WHERE actor_user_id = ${profile.userId}
			`,
		]);

		await Promise.all([
			...listingRows.map(
				(row) =>
					this.sql`
					UPDATE ticket_exchange_listings
					SET
						contact_snapshot = ${this.sql.json({
							...filterContactSnapshot(snapshot, row.contact_methods ?? []),
						})},
						updated_at = NOW()
					WHERE id = ${row.id}
				`,
			),
			...interestRows.map(
				(row) =>
					this.sql`
					UPDATE ticket_exchange_interests
					SET contact_snapshot = ${this.sql.json({
						...filterContactSnapshot(snapshot, row.contact_methods ?? []),
					})}
					WHERE id = ${row.id}
				`,
			),
		]);
	}

	async createListing(input: {
		eventKey: string;
		eventSlug: string;
		eventName: string;
		listingType: TicketExchangeListingType;
		quantityLabel: string;
		priceLabel: string;
		priceAmountMinor: number | null;
		priceCurrency: TicketExchangePriceCurrency | null;
		priceBasis: TicketExchangePriceBasis;
		priceSource: TicketExchangePriceSource;
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
				price_amount_minor,
				price_currency,
				price_basis,
				price_source,
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
				${input.priceAmountMinor},
				${input.priceCurrency},
				${input.priceBasis},
				${input.priceSource},
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
				listings.price_amount_minor,
				listings.price_currency::text AS price_currency,
				listings.price_basis::text AS price_basis,
				listings.price_source::text AS price_source,
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
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_interests interests
					WHERE interests.listing_id = listings.id
				) AS interest_count
			FROM ticket_exchange_listings listings
			WHERE (${eventKey}::text IS NULL OR listings.event_key = ${eventKey})
				AND (
					(listings.status IN ('active', 'paused') AND listings.expires_at > NOW())
					OR (
						listings.status = 'resolved'
						AND COALESCE(listings.resolved_at, listings.updated_at) >
							NOW() - (${TICKET_EXCHANGE_PUBLIC_RESOLVED_TOMBSTONE_MINUTES} * INTERVAL '1 minute')
					)
					OR listings.owner_user_id = ${userId}
					OR EXISTS (
						SELECT 1
						FROM ticket_exchange_interests mine
						WHERE mine.listing_id = listings.id
							AND mine.actor_user_id = ${userId}
					)
				)
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
		const ownerListingIds = userId
			? rows.filter((row) => row.owner_user_id === userId).map((row) => row.id)
			: [];
		const hasOwnerListings = ownerListingIds.length > 0;
		const ownerListingIdsForQuery = hasOwnerListings ? ownerListingIds : [""];
		const interests =
			userId && listingIds.length > 0
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
						AND (
							actor_user_id = ${userId}
							OR (
								${hasOwnerListings} = true
								AND listing_id = ANY(${ownerListingIdsForQuery})
							)
						)
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
			const rowPrice = getRowPrice(row);
			return {
				id: row.id,
				eventKey: row.event_key,
				eventSlug: row.event_slug,
				eventName: row.event_name,
				listingType: row.listing_type,
				quantityLabel: row.quantity_label,
				priceLabel: row.price_label,
				...rowPrice,
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
				price_amount_minor,
				price_currency::text AS price_currency,
				price_basis::text AS price_basis,
				price_source::text AS price_source,
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
			...getRowPrice(source),
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
		reporterEmail: string;
		reason: TicketExchangeReportReason;
		details: string;
	}): Promise<{
		reportId: string;
		listingId: string;
		eventKey: string | null;
		eventName: string | null;
		ownerUserId: string | null;
		ownerEmail: string | null;
		createdAt: string;
	}> {
		await this.ready();
		const rows = await this.sql<ReportCreateRow[]>`
			WITH reportable_listing AS (
				SELECT
					id,
					event_key,
					event_name,
					owner_user_id,
					owner_email
				FROM ticket_exchange_listings
				WHERE id = ${input.listingId}
					AND status = 'active'
					AND expires_at > NOW()
					AND owner_user_id <> ${input.reporterUserId}
					AND LOWER(owner_email) <> ${input.reporterEmail.toLowerCase()}
			),
			upserted_report AS (
				INSERT INTO ticket_exchange_reports (
					id,
					listing_id,
					reporter_user_id,
					reason,
					details
				)
				SELECT
					${generateUserId()},
					reportable_listing.id,
					${input.reporterUserId},
					${input.reason},
					${input.details}
				FROM reportable_listing
				ON CONFLICT (listing_id, reporter_user_id)
				DO UPDATE SET
					reason = EXCLUDED.reason,
					details = EXCLUDED.details,
					created_at = NOW(),
					reviewed_at = NULL,
					reviewed_by = NULL,
					review_note = ''
				RETURNING id, listing_id, created_at
			)
			SELECT
				upserted_report.id,
				upserted_report.listing_id,
				upserted_report.created_at,
				reportable_listing.event_key AS listing_event_key,
				reportable_listing.event_name AS listing_event_name,
				reportable_listing.owner_user_id,
				reportable_listing.owner_email
			FROM upserted_report
			INNER JOIN reportable_listing
				ON reportable_listing.id = upserted_report.listing_id
		`;
		const row = rows[0];
		if (!row) {
			throw new Error(
				"Only active Ticket Exchange listings from other users can be reported.",
			);
		}
		return {
			reportId: row.id,
			listingId: row.listing_id,
			eventKey: row.listing_event_key,
			eventName: row.listing_event_name,
			ownerUserId: row.owner_user_id,
			ownerEmail: row.owner_email,
			createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
		};
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

	async getRecentListingsForBot(
		limit = 10,
	): Promise<TicketExchangeListingView[]> {
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
				listings.price_amount_minor,
				listings.price_currency::text AS price_currency,
				listings.price_basis::text AS price_basis,
				listings.price_source::text AS price_source,
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
			...getRowPrice(row),
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
		const [countRows, recentListings, recentReports, unlockWatch] =
			await Promise.all([
				this.sql<AdminCountsRow[]>`
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
							WHERE reason = 'interest_owner_reveal'
						) AS contact_unlock_count
					FROM ticket_exchange_listings
				`,
				this.getAdminListings(safeLimit),
				this.getAdminReports(safeLimit),
				this.getAdminUnlockWatch(8),
			]);
		const counts = countRows[0];
		return {
			activeSellingCount: counts?.active_selling_count ?? 0,
			activeLookingCount: counts?.active_looking_count ?? 0,
			pendingReportCount: counts?.pending_report_count ?? 0,
			botPendingCount: counts?.bot_pending_count ?? 0,
			botAnnouncedCount: counts?.bot_announced_count ?? 0,
			contactUnlockCount: counts?.contact_unlock_count ?? 0,
			unlockWatch,
			recentListings,
			recentReports,
		};
	}

	async getAdminStatsWindow(input: {
		startAt: string;
		endAt: string;
	}): Promise<TicketExchangeAdminStatsWindow> {
		await this.ready();
		const rows = await this.sql<AdminStatsWindowRow[]>`
			SELECT
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS listing_create_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE listing_type = 'selling'
						AND created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS selling_listing_create_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE listing_type = 'looking'
						AND created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS looking_listing_create_count,
				(
					SELECT COUNT(DISTINCT owner_user_id)::int
					FROM ticket_exchange_listings
					WHERE created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS unique_listing_owner_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_interests
					WHERE created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS interest_create_count,
				(
					SELECT COUNT(DISTINCT actor_user_id)::int
					FROM ticket_exchange_interests
					WHERE created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS unique_interested_user_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_reports
					WHERE created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS report_create_count,
				(
					SELECT COUNT(DISTINCT listing_id)::int
					FROM ticket_exchange_reports
					WHERE created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS unique_reported_listing_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE status = 'resolved'
						AND COALESCE(resolved_at, updated_at) >= ${input.startAt}
						AND COALESCE(resolved_at, updated_at) < ${input.endAt}
				) AS resolved_listing_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE status = 'removed'
						AND updated_at >= ${input.startAt}
						AND updated_at < ${input.endAt}
				) AS removed_listing_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE listing_type = 'selling'
						AND status = 'active'
						AND expires_at > NOW()
				) AS active_selling_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE listing_type = 'looking'
						AND status = 'active'
						AND expires_at > NOW()
				) AS active_looking_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_reports
					WHERE reviewed_at IS NULL
				) AS pending_report_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE status = 'active'
						AND expires_at > NOW()
						AND bot_announced_at IS NULL
				) AS bot_pending_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_listings
					WHERE bot_announced_at IS NOT NULL
				) AS bot_announced_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_contact_audit
					WHERE reason = 'interest_owner_reveal'
						AND created_at >= ${input.startAt}
						AND created_at < ${input.endAt}
				) AS contact_unlock_count
		`;
		const row = rows[0];
		return {
			listingCreateCount: row?.listing_create_count ?? 0,
			sellingListingCreateCount: row?.selling_listing_create_count ?? 0,
			lookingListingCreateCount: row?.looking_listing_create_count ?? 0,
			uniqueListingOwnerCount: row?.unique_listing_owner_count ?? 0,
			interestCreateCount: row?.interest_create_count ?? 0,
			uniqueInterestedUserCount: row?.unique_interested_user_count ?? 0,
			reportCreateCount: row?.report_create_count ?? 0,
			uniqueReportedListingCount: row?.unique_reported_listing_count ?? 0,
			resolvedListingCount: row?.resolved_listing_count ?? 0,
			removedListingCount: row?.removed_listing_count ?? 0,
			activeSellingCount: row?.active_selling_count ?? 0,
			activeLookingCount: row?.active_looking_count ?? 0,
			pendingReportCount: row?.pending_report_count ?? 0,
			botPendingCount: row?.bot_pending_count ?? 0,
			botAnnouncedCount: row?.bot_announced_count ?? 0,
			contactUnlockCount: row?.contact_unlock_count ?? 0,
		};
	}

	async listAdminEventStatsWindow(input: {
		startAt: string;
		endAt: string;
		limit?: number;
	}): Promise<TicketExchangeAdminEventStats[]> {
		await this.ready();
		const safeLimit = Math.min(100, Math.max(1, input.limit ?? 20));
		const rows = await this.sql<AdminEventStatsWindowRow[]>`
			WITH listing_counts AS (
				SELECT
					event_key,
					MAX(event_name) AS event_name,
					COUNT(*)::int AS listing_create_count,
					COUNT(*) FILTER (WHERE listing_type = 'selling')::int AS selling_listing_create_count,
					COUNT(*) FILTER (WHERE listing_type = 'looking')::int AS looking_listing_create_count
				FROM ticket_exchange_listings
				WHERE created_at >= ${input.startAt}
					AND created_at < ${input.endAt}
				GROUP BY event_key
			),
			resolved_counts AS (
				SELECT
					event_key,
					COUNT(*)::int AS resolved_listing_count
				FROM ticket_exchange_listings
				WHERE status = 'resolved'
					AND COALESCE(resolved_at, updated_at) >= ${input.startAt}
					AND COALESCE(resolved_at, updated_at) < ${input.endAt}
				GROUP BY event_key
			),
			interest_counts AS (
				SELECT
					listings.event_key,
					COUNT(*)::int AS interest_create_count
				FROM ticket_exchange_interests interests
				INNER JOIN ticket_exchange_listings listings
					ON listings.id = interests.listing_id
				WHERE interests.created_at >= ${input.startAt}
					AND interests.created_at < ${input.endAt}
				GROUP BY listings.event_key
			),
			report_counts AS (
				SELECT
					listings.event_key,
					COUNT(*)::int AS report_create_count
				FROM ticket_exchange_reports reports
				INNER JOIN ticket_exchange_listings listings
					ON listings.id = reports.listing_id
				WHERE reports.created_at >= ${input.startAt}
					AND reports.created_at < ${input.endAt}
				GROUP BY listings.event_key
			),
			event_keys AS (
				SELECT event_key FROM listing_counts
				UNION
				SELECT event_key FROM resolved_counts
				UNION
				SELECT event_key FROM interest_counts
				UNION
				SELECT event_key FROM report_counts
			)
			SELECT
				event_keys.event_key,
				COALESCE(listing_counts.event_name, event_keys.event_key) AS event_name,
				COALESCE(listing_counts.listing_create_count, 0)::int AS listing_create_count,
				COALESCE(listing_counts.selling_listing_create_count, 0)::int AS selling_listing_create_count,
				COALESCE(listing_counts.looking_listing_create_count, 0)::int AS looking_listing_create_count,
				COALESCE(interest_counts.interest_create_count, 0)::int AS interest_create_count,
				COALESCE(report_counts.report_create_count, 0)::int AS report_create_count,
				COALESCE(resolved_counts.resolved_listing_count, 0)::int AS resolved_listing_count
			FROM event_keys
			LEFT JOIN listing_counts ON listing_counts.event_key = event_keys.event_key
			LEFT JOIN resolved_counts ON resolved_counts.event_key = event_keys.event_key
			LEFT JOIN interest_counts ON interest_counts.event_key = event_keys.event_key
			LEFT JOIN report_counts ON report_counts.event_key = event_keys.event_key
			ORDER BY interest_create_count DESC, listing_create_count DESC, report_create_count DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			eventKey: row.event_key,
			eventName: row.event_name,
			listingCreateCount: row.listing_create_count,
			sellingListingCreateCount: row.selling_listing_create_count,
			lookingListingCreateCount: row.looking_listing_create_count,
			interestCreateCount: row.interest_create_count,
			reportCreateCount: row.report_create_count,
			resolvedListingCount: row.resolved_listing_count,
		}));
	}

	async getPendingReportNotificationSummary(): Promise<{
		count: number;
		oldestCreatedAt: string | null;
		newestCreatedAt: string | null;
	}> {
		await this.ready();
		const rows = await this.sql<NotificationSummaryRow[]>`
			SELECT
				COUNT(*)::int AS count,
				MIN(created_at) AS oldest_created_at,
				MAX(created_at) AS newest_created_at
			FROM ticket_exchange_reports
			WHERE reviewed_at IS NULL
		`;
		const row = rows[0];
		return {
			count: row?.count ?? 0,
			oldestCreatedAt: toIso(row?.oldest_created_at ?? null),
			newestCreatedAt: toIso(row?.newest_created_at ?? null),
		};
	}

	async getAdminUnlockWatch(
		limit = 8,
	): Promise<TicketExchangeAdminUnlockWatch[]> {
		await this.ready();
		const safeLimit = Math.min(20, Math.max(1, limit));
		const rows = await this.sql<AdminUnlockWatchRow[]>`
			SELECT
				interests.actor_user_id,
				MAX(interests.actor_email) AS actor_email,
				COUNT(DISTINCT interests.listing_id) FILTER (
					WHERE
						(listings.status = 'active' AND listings.expires_at > NOW())
						OR interests.created_at > NOW() - (${TICKET_EXCHANGE_INTEREST_LOCK_MINUTES} * INTERVAL '1 minute')
				)::int AS active_or_locked_count,
				COUNT(DISTINCT interests.listing_id) FILTER (
					WHERE interests.created_at > NOW() - INTERVAL '24 hours'
				)::int AS daily_unlock_count,
				MAX(interests.created_at) AS latest_unlock_at
			FROM ticket_exchange_interests interests
			INNER JOIN ticket_exchange_listings listings
				ON listings.id = interests.listing_id
			GROUP BY interests.actor_user_id
			HAVING
				COUNT(DISTINCT interests.listing_id) FILTER (
					WHERE
						(listings.status = 'active' AND listings.expires_at > NOW())
						OR interests.created_at > NOW() - (${TICKET_EXCHANGE_INTEREST_LOCK_MINUTES} * INTERVAL '1 minute')
				) > 0
				OR COUNT(DISTINCT interests.listing_id) FILTER (
					WHERE interests.created_at > NOW() - INTERVAL '24 hours'
				) > 0
			ORDER BY daily_unlock_count DESC, active_or_locked_count DESC, latest_unlock_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			actorUserId: row.actor_user_id,
			actorEmail: row.actor_email,
			activeOrLockedCount: row.active_or_locked_count,
			dailyUnlockCount: row.daily_unlock_count,
			latestUnlockAt: toIso(row.latest_unlock_at) ?? new Date(0).toISOString(),
		}));
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
				listings.price_amount_minor,
				listings.price_currency::text AS price_currency,
				listings.price_basis::text AS price_basis,
				listings.price_source::text AS price_source,
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
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_interests interests
					WHERE interests.listing_id = listings.id
				) AS interest_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_reports reports
					WHERE reports.listing_id = listings.id
				) AS report_count
			FROM ticket_exchange_listings listings
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
			...getRowPrice(row),
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
				reporter_users.email_normalized AS reporter_email,
				reporter_users.first_name AS reporter_first_name,
				reporter_users.last_name AS reporter_last_name,
				reports.reason::text AS reason,
				reports.details,
				reports.created_at,
				reports.reviewed_at,
				reports.reviewed_by,
				reports.review_note,
				COALESCE(listings.event_key, '') AS listing_event_key,
				COALESCE(listings.event_slug, '') AS listing_event_slug,
				COALESCE(listings.event_name, 'Removed listing') AS listing_event_name,
				COALESCE(listings.listing_type::text, 'selling') AS listing_type,
				COALESCE(listings.quantity_label, '') AS quantity_label,
				COALESCE(listings.price_label, '') AS price_label,
				COALESCE(listings.status::text, 'removed') AS status,
				COALESCE(listings.owner_user_id, '') AS owner_user_id,
				COALESCE(listings.owner_email, '') AS owner_email,
				owner_users.email_normalized AS owner_profile_email,
				owner_users.first_name AS owner_first_name,
				owner_users.last_name AS owner_last_name,
				COALESCE(listings.expires_at, reports.created_at) AS expires_at
			FROM ticket_exchange_reports reports
			LEFT JOIN ticket_exchange_listings listings
				ON listings.id = reports.listing_id
			LEFT JOIN app_users reporter_users
				ON reporter_users.id = reports.reporter_user_id
			LEFT JOIN app_users owner_users
				ON owner_users.id = listings.owner_user_id
			ORDER BY
				CASE WHEN reports.reviewed_at IS NULL THEN 0 ELSE 1 END,
				reports.created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			id: row.id,
			listingId: row.listing_id,
			reporterUserId: row.reporter_user_id,
			reporter: {
				userId: row.reporter_user_id,
				email: row.reporter_email,
				firstName: row.reporter_first_name,
				lastName: row.reporter_last_name,
			},
			reason: row.reason,
			details: row.details,
			createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
			reviewedAt: toIso(row.reviewed_at),
			reviewedBy: row.reviewed_by,
			reviewNote: row.review_note,
			listing: {
				id: row.listing_id,
				eventKey: row.listing_event_key,
				eventSlug: row.listing_event_slug,
				eventName: row.listing_event_name,
				listingType: row.listing_type,
				quantityLabel: row.quantity_label,
				priceLabel: row.price_label,
				status: row.status,
				effectiveStatus: getEffectiveListingStatus({
					status: row.status,
					expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
				}),
				ownerUserId: row.owner_user_id,
				ownerEmail: row.owner_email,
				owner: {
					userId: row.owner_user_id,
					email: row.owner_profile_email ?? row.owner_email,
					firstName: row.owner_first_name,
					lastName: row.owner_last_name,
				},
			},
		}));
	}

	async getAdminListingsForUser(input: {
		userId?: string | null;
		email?: string | null;
		limit?: number;
	}): Promise<TicketExchangeAdminListing[]> {
		await this.ready();
		const userId = input.userId?.trim() || null;
		const email = input.email?.trim().toLowerCase() || null;
		if (!userId && !email) return [];
		const safeLimit = Math.min(100, Math.max(1, input.limit ?? 40));
		const rows = await this.sql<ListingRow[]>`
			SELECT
				listings.id,
				listings.event_key,
				listings.event_slug,
				listings.event_name,
				listings.listing_type::text AS listing_type,
				listings.quantity_label,
				listings.price_label,
				listings.price_amount_minor,
				listings.price_currency::text AS price_currency,
				listings.price_basis::text AS price_basis,
				listings.price_source::text AS price_source,
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
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_interests interests
					WHERE interests.listing_id = listings.id
				) AS interest_count,
				(
					SELECT COUNT(*)::int
					FROM ticket_exchange_reports reports
					WHERE reports.listing_id = listings.id
				) AS report_count
			FROM ticket_exchange_listings listings
			WHERE
				(${userId}::text IS NOT NULL AND listings.owner_user_id = ${userId})
				OR (${email}::text IS NOT NULL AND LOWER(listings.owner_email) = ${email})
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
			...getRowPrice(row),
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

	async getAdminReportsForUser(input: {
		userId?: string | null;
		email?: string | null;
		limit?: number;
	}): Promise<TicketExchangeAdminReport[]> {
		await this.ready();
		const userId = input.userId?.trim() || null;
		const email = input.email?.trim().toLowerCase() || null;
		if (!userId && !email) return [];
		const safeLimit = Math.min(100, Math.max(1, input.limit ?? 40));
		const rows = await this.sql<AdminReportRow[]>`
			SELECT
				reports.id,
				reports.listing_id,
				reports.reporter_user_id,
				reporter_users.email_normalized AS reporter_email,
				reporter_users.first_name AS reporter_first_name,
				reporter_users.last_name AS reporter_last_name,
				reports.reason::text AS reason,
				reports.details,
				reports.created_at,
				reports.reviewed_at,
				reports.reviewed_by,
				reports.review_note,
				COALESCE(listings.event_key, '') AS listing_event_key,
				COALESCE(listings.event_slug, '') AS listing_event_slug,
				COALESCE(listings.event_name, 'Removed listing') AS listing_event_name,
				COALESCE(listings.listing_type::text, 'selling') AS listing_type,
				COALESCE(listings.quantity_label, '') AS quantity_label,
				COALESCE(listings.price_label, '') AS price_label,
				COALESCE(listings.price_amount_minor, NULL) AS price_amount_minor,
				COALESCE(listings.price_currency::text, NULL) AS price_currency,
				COALESCE(listings.price_basis::text, 'unknown') AS price_basis,
				COALESCE(listings.price_source::text, 'user') AS price_source,
				COALESCE(listings.status::text, 'removed') AS status,
				COALESCE(listings.owner_user_id, '') AS owner_user_id,
				COALESCE(listings.owner_email, '') AS owner_email,
				owner_users.email_normalized AS owner_profile_email,
				owner_users.first_name AS owner_first_name,
				owner_users.last_name AS owner_last_name,
				COALESCE(listings.expires_at, reports.created_at) AS expires_at
			FROM ticket_exchange_reports reports
			LEFT JOIN ticket_exchange_listings listings
				ON listings.id = reports.listing_id
			LEFT JOIN app_users reporter_users
				ON reporter_users.id = reports.reporter_user_id
			LEFT JOIN app_users owner_users
				ON owner_users.id = listings.owner_user_id
			WHERE
				(${userId}::text IS NOT NULL AND reports.reporter_user_id = ${userId})
				OR (${userId}::text IS NOT NULL AND listings.owner_user_id = ${userId})
				OR (${email}::text IS NOT NULL AND LOWER(listings.owner_email) = ${email})
			ORDER BY reports.created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map((row) => ({
			id: row.id,
			listingId: row.listing_id,
			reporterUserId: row.reporter_user_id,
			reporter: {
				userId: row.reporter_user_id,
				email: row.reporter_email,
				firstName: row.reporter_first_name,
				lastName: row.reporter_last_name,
			},
			reason: row.reason,
			details: row.details,
			createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
			reviewedAt: toIso(row.reviewed_at),
			reviewedBy: row.reviewed_by,
			reviewNote: row.review_note,
			listing: {
				id: row.listing_id,
				eventKey: row.listing_event_key,
				eventSlug: row.listing_event_slug,
				eventName: row.listing_event_name,
				listingType: row.listing_type,
				quantityLabel: row.quantity_label,
				priceLabel: row.price_label,
				status: row.status,
				effectiveStatus: getEffectiveListingStatus({
					status: row.status,
					expiresAt: toIso(row.expires_at) ?? new Date(0).toISOString(),
				}),
				ownerUserId: row.owner_user_id,
				ownerEmail: row.owner_email,
				owner: {
					userId: row.owner_user_id,
					email: row.owner_profile_email ?? row.owner_email,
					firstName: row.owner_first_name,
					lastName: row.owner_last_name,
				},
			},
		}));
	}

	async updateListingStatusAsAdmin(input: {
		listingId: string;
		status: Exclude<TicketExchangeListingStatus, "expired">;
	}): Promise<{ eventKey: string | null; updated: boolean }> {
		await this.ready();
		const rows = await this.sql<Array<{ event_key: string }>>`
			UPDATE ticket_exchange_listings
			SET
				status = ${input.status},
				resolved_at = CASE WHEN ${input.status} = 'resolved' THEN NOW() ELSE resolved_at END,
				updated_at = NOW()
			WHERE id = ${input.listingId}
			RETURNING event_key
		`;
		return {
			eventKey: rows[0]?.event_key ?? null,
			updated: Boolean(rows[0]),
		};
	}

	async reviewReportAsAdmin(input: {
		reportId: string;
		reviewedBy: string;
		reviewNote: string;
	}): Promise<{
		eventKey: string | null;
		listingId: string | null;
		reviewed: boolean;
	}> {
		await this.ready();
		const rows = await this.sql<
			Array<{ event_key: string | null; listing_id: string | null }>
		>`
			WITH reviewed_report AS (
				UPDATE ticket_exchange_reports
				SET
					reviewed_at = NOW(),
					reviewed_by = ${input.reviewedBy},
					review_note = ${input.reviewNote}
				WHERE id = ${input.reportId}
				RETURNING listing_id
			)
			SELECT
				reviewed_report.listing_id,
				listings.event_key
			FROM reviewed_report
			LEFT JOIN ticket_exchange_listings listings
				ON listings.id = reviewed_report.listing_id
		`;
		return {
			eventKey: rows[0]?.event_key ?? null,
			listingId: rows[0]?.listing_id ?? null,
			reviewed: Boolean(rows[0]),
		};
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
