import "server-only";

import { randomUUID } from "crypto";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

export type PartnerActivationStatus =
	| "pending"
	| "processing"
	| "activated"
	| "dismissed";

export type PartnerPlacementTier = "spotlight" | "promoted";

export type PartnerActivationRecord = {
	id: string;
	source: "stripe";
	sourceEventId: string;
	status: PartnerActivationStatus;
	packageKey: string | null;
	paymentLinkId: string | null;
	stripeSessionId: string | null;
	customerEmail: string | null;
	customerName: string | null;
	eventName: string | null;
	eventUrl: string | null;
	amountTotalCents: number | null;
	currency: string | null;
	notes: string | null;
	metadata: Record<string, unknown>;
	rawPayload: Record<string, unknown>;
	fulfilledEventKey: string | null;
	fulfilledTier: PartnerPlacementTier | null;
	fulfilledStartAt: string | null;
	fulfilledEndAt: string | null;
	partnerStatsToken: string | null;
	partnerStatsRevokedAt: string | null;
	createdAt: string;
	updatedAt: string;
	activatedAt: string | null;
};

type PartnerActivationRow = {
	id: string;
	source: "stripe";
	source_event_id: string;
	status: PartnerActivationStatus;
	package_key: string | null;
	payment_link_id: string | null;
	stripe_session_id: string | null;
	customer_email: string | null;
	customer_name: string | null;
	event_name: string | null;
	event_url: string | null;
	amount_total_cents: number | null;
	currency: string | null;
	notes: string | null;
	metadata: unknown;
	raw_payload: unknown;
	fulfilled_event_key: string | null;
	fulfilled_tier: PartnerPlacementTier | null;
	fulfilled_start_at: Date | string | null;
	fulfilled_end_at: Date | string | null;
	partner_stats_token: string | null;
	partner_stats_revoked_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
	activated_at: Date | string | null;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

declare global {
	var __ooocFeteFinderPartnerActivationRepository:
		| PartnerActivationRepository
		| undefined;
}

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null => {
	if (!value) return null;
	return toIsoString(value);
};

const toJsonObject = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return value as Record<string, unknown>;
};

const toRecord = (row: PartnerActivationRow): PartnerActivationRecord => ({
	id: row.id,
	source: row.source,
	sourceEventId: row.source_event_id,
	status: row.status,
	packageKey: row.package_key,
	paymentLinkId: row.payment_link_id,
	stripeSessionId: row.stripe_session_id,
	customerEmail: row.customer_email,
	customerName: row.customer_name,
	eventName: row.event_name,
	eventUrl: row.event_url,
	amountTotalCents: row.amount_total_cents,
	currency: row.currency,
	notes: row.notes,
	metadata: toJsonObject(row.metadata),
	rawPayload: toJsonObject(row.raw_payload),
	fulfilledEventKey: row.fulfilled_event_key,
	fulfilledTier: row.fulfilled_tier,
	fulfilledStartAt: toNullableIsoString(row.fulfilled_start_at),
	fulfilledEndAt: toNullableIsoString(row.fulfilled_end_at),
	partnerStatsToken: row.partner_stats_token,
	partnerStatsRevokedAt: toNullableIsoString(row.partner_stats_revoked_at),
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
	activatedAt: toNullableIsoString(row.activated_at),
});

const toJsonObjectForSql = (value: unknown): Record<string, unknown> => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
};

const toJsonValue = (value: unknown): JsonValue => {
	if (value == null) return null;
	return JSON.parse(JSON.stringify(value)) as JsonValue;
};

export class PartnerActivationRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_partner_activation_queue (
				id TEXT PRIMARY KEY,
				source TEXT NOT NULL CHECK (source IN ('stripe')),
				source_event_id TEXT NOT NULL UNIQUE,
				status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'activated', 'dismissed')),
				package_key TEXT,
				payment_link_id TEXT,
				stripe_session_id TEXT,
				customer_email TEXT,
				customer_name TEXT,
				event_name TEXT,
				event_url TEXT,
				amount_total_cents INTEGER,
				currency TEXT,
				notes TEXT,
				metadata JSONB NOT NULL,
				raw_payload JSONB NOT NULL,
				fulfilled_event_key TEXT,
				fulfilled_tier TEXT CHECK (fulfilled_tier IN ('spotlight', 'promoted')),
				fulfilled_start_at TIMESTAMPTZ,
				fulfilled_end_at TIMESTAMPTZ,
				partner_stats_token TEXT,
				partner_stats_revoked_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				activated_at TIMESTAMPTZ
			)
		`;

		await this.sql`
			ALTER TABLE app_partner_activation_queue
			ADD COLUMN IF NOT EXISTS fulfilled_event_key TEXT
		`;
		await this.sql`
			ALTER TABLE app_partner_activation_queue
			ADD COLUMN IF NOT EXISTS fulfilled_tier TEXT
		`;
		await this.sql`
			ALTER TABLE app_partner_activation_queue
			ADD COLUMN IF NOT EXISTS fulfilled_start_at TIMESTAMPTZ
		`;
		await this.sql`
			ALTER TABLE app_partner_activation_queue
			ADD COLUMN IF NOT EXISTS fulfilled_end_at TIMESTAMPTZ
		`;
		await this.sql`
			ALTER TABLE app_partner_activation_queue
			ADD COLUMN IF NOT EXISTS partner_stats_token TEXT
		`;
		await this.sql`
			ALTER TABLE app_partner_activation_queue
			ADD COLUMN IF NOT EXISTS partner_stats_revoked_at TIMESTAMPTZ
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_partner_activation_queue_status_created
			ON app_partner_activation_queue (status, created_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_partner_activation_queue_fulfilled_event_key
			ON app_partner_activation_queue (fulfilled_event_key)
		`;
		await this.sql`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_app_partner_activation_queue_partner_stats_token
			ON app_partner_activation_queue (partner_stats_token)
			WHERE partner_stats_token IS NOT NULL
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async enqueueFromStripe(input: {
		sourceEventId: string;
		packageKey?: string | null;
		paymentLinkId?: string | null;
		stripeSessionId?: string | null;
		customerEmail?: string | null;
		customerName?: string | null;
		eventName?: string | null;
		eventUrl?: string | null;
		amountTotalCents?: number | null;
		currency?: string | null;
		notes?: string | null;
		metadata?: Record<string, unknown>;
		rawPayload: Record<string, unknown>;
	}): Promise<{ inserted: boolean; record: PartnerActivationRecord | null }> {
		await this.ready();
		const id = randomUUID();
		const nowIso = new Date().toISOString();
		const rows = await this.sql<PartnerActivationRow[]>`
			INSERT INTO app_partner_activation_queue (
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				created_at,
				updated_at
			)
			VALUES (
				${id},
				'stripe',
				${input.sourceEventId},
				'pending',
				${input.packageKey ?? null},
				${input.paymentLinkId ?? null},
				${input.stripeSessionId ?? null},
				${input.customerEmail ?? null},
				${input.customerName ?? null},
				${input.eventName ?? null},
				${input.eventUrl ?? null},
				${input.amountTotalCents ?? null},
				${input.currency ?? null},
				${input.notes ?? null},
				${this.sql.json(toJsonValue(toJsonObjectForSql(input.metadata ?? {})))},
				${this.sql.json(toJsonValue(toJsonObjectForSql(input.rawPayload)))},
				${nowIso},
				${nowIso}
			)
			ON CONFLICT (source_event_id) DO NOTHING
			RETURNING
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
		`;

		const row = rows[0];
		if (!row) {
			return { inserted: false, record: null };
		}
		return { inserted: true, record: toRecord(row) };
	}

	async listRecent(limit = 100): Promise<PartnerActivationRecord[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(limit, 500));
		const rows = await this.sql<PartnerActivationRow[]>`
			SELECT
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
			FROM app_partner_activation_queue
			ORDER BY created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map(toRecord);
	}

	async listAll(limit = 5000): Promise<PartnerActivationRecord[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(limit, 20_000));
		const rows = await this.sql<PartnerActivationRow[]>`
			SELECT
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
			FROM app_partner_activation_queue
			ORDER BY created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map(toRecord);
	}

	async findById(id: string): Promise<PartnerActivationRecord | null> {
		await this.ready();
		const rows = await this.sql<PartnerActivationRow[]>`
			SELECT
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
			FROM app_partner_activation_queue
			WHERE id = ${id}
			LIMIT 1
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async findActivatedReportByWindow(input: {
		eventKey: string;
		tier: PartnerPlacementTier;
		startAt: string;
		endAt: string;
	}): Promise<PartnerActivationRecord | null> {
		await this.ready();
		const rows = await this.sql<PartnerActivationRow[]>`
			SELECT
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
			FROM app_partner_activation_queue
			WHERE status = 'activated'
				AND partner_stats_token IS NOT NULL
				AND partner_stats_revoked_at IS NULL
				AND fulfilled_event_key = ${input.eventKey}
				AND fulfilled_tier = ${input.tier}
				AND fulfilled_start_at = ${input.startAt}
				AND fulfilled_end_at = ${input.endAt}
			ORDER BY created_at DESC
			LIMIT 1
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async listActivatedReportsForEventKeys(
		eventKeys: string[],
	): Promise<PartnerActivationRecord[]> {
		await this.ready();
		const normalizedEventKeys = [...new Set(eventKeys.map((key) => key.trim()))]
			.filter((key) => key.length > 0)
			.slice(0, 500);
		if (normalizedEventKeys.length === 0) return [];

		const rows = await this.sql<PartnerActivationRow[]>`
			SELECT
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
			FROM app_partner_activation_queue
			WHERE status = 'activated'
				AND partner_stats_token IS NOT NULL
				AND partner_stats_revoked_at IS NULL
				AND fulfilled_event_key = ANY(${normalizedEventKeys})
			ORDER BY created_at DESC
			LIMIT 1000
		`;
		return rows.map(toRecord);
	}

	async updateStatus(input: {
		id: string;
		status: PartnerActivationStatus;
		notes?: string | null;
	}): Promise<PartnerActivationRecord | null> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const nextNotes = input.notes?.trim() || null;
		const activatedAt =
			input.status === "activated" ? nowIso : (null as string | null);
		const rows = await this.sql<PartnerActivationRow[]>`
			UPDATE app_partner_activation_queue
			SET
				status = ${input.status},
				notes = COALESCE(${nextNotes}, notes),
				activated_at = CASE
					WHEN ${activatedAt}::timestamptz IS NOT NULL THEN ${activatedAt}
					WHEN ${input.status} = 'activated' THEN COALESCE(activated_at, ${nowIso})
					ELSE NULL
				END,
				updated_at = ${nowIso}
			WHERE id = ${input.id}
			RETURNING
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async markFulfilled(input: {
		id: string;
		eventKey: string;
		tier: PartnerPlacementTier;
		startAt: string;
		endAt: string;
		notes?: string | null;
		partnerStatsToken: string;
	}): Promise<PartnerActivationRecord | null> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const nextNotes = input.notes?.trim() || null;
		const rows = await this.sql<PartnerActivationRow[]>`
			UPDATE app_partner_activation_queue
			SET
				status = 'activated',
				notes = COALESCE(${nextNotes}, notes),
				fulfilled_event_key = ${input.eventKey},
				fulfilled_tier = ${input.tier},
				fulfilled_start_at = ${input.startAt},
				fulfilled_end_at = ${input.endAt},
				partner_stats_token = COALESCE(partner_stats_token, ${input.partnerStatsToken}),
				partner_stats_revoked_at = NULL,
				activated_at = COALESCE(activated_at, ${nowIso}),
				updated_at = ${nowIso}
			WHERE id = ${input.id}
			RETURNING
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async revokePartnerStats(input: {
		id: string;
		notes?: string | null;
	}): Promise<PartnerActivationRecord | null> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const nextNotes = input.notes?.trim() || null;
		const rows = await this.sql<PartnerActivationRow[]>`
			UPDATE app_partner_activation_queue
			SET
				partner_stats_revoked_at = COALESCE(partner_stats_revoked_at, ${nowIso}),
				notes = COALESCE(${nextNotes}, notes),
				updated_at = ${nowIso}
			WHERE id = ${input.id}
			RETURNING
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async regeneratePartnerStatsToken(input: {
		id: string;
		partnerStatsToken: string;
		notes?: string | null;
	}): Promise<PartnerActivationRecord | null> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const nextNotes = input.notes?.trim() || null;
		const rows = await this.sql<PartnerActivationRow[]>`
			UPDATE app_partner_activation_queue
			SET
				partner_stats_token = ${input.partnerStatsToken},
				partner_stats_revoked_at = NULL,
				notes = COALESCE(${nextNotes}, notes),
				updated_at = ${nowIso}
			WHERE id = ${input.id}
			RETURNING
				id,
				source,
				source_event_id,
				status,
				package_key,
				payment_link_id,
				stripe_session_id,
				customer_email,
				customer_name,
				event_name,
				event_url,
				amount_total_cents,
				currency,
				notes,
				metadata,
				raw_payload,
				fulfilled_event_key,
				fulfilled_tier,
				fulfilled_start_at,
				fulfilled_end_at,
				partner_stats_token,
				partner_stats_revoked_at,
				created_at,
				updated_at,
				activated_at
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async cleanupDismissedInternalReports(input?: {
		olderThanDays?: number;
	}): Promise<number> {
		await this.ready();
		const olderThanDays = Math.max(1, input?.olderThanDays ?? 90);
		const rows = await this.sql<Array<{ deleted_count: number }>>`
			WITH deleted AS (
				DELETE FROM app_partner_activation_queue
				WHERE status = 'dismissed'
					AND (
						package_key LIKE 'manual-test-%'
						OR package_key LIKE 'scheduler-report-%'
					)
					AND updated_at < NOW() - (${olderThanDays}::int * INTERVAL '1 day')
				RETURNING id
			)
			SELECT COUNT(*)::int AS deleted_count FROM deleted
		`;
		return rows[0]?.deleted_count ?? 0;
	}

	async metrics(): Promise<{
		total: number;
		pending: number;
		processing: number;
		activated: number;
		dismissed: number;
	}> {
		await this.ready();
		const rows = await this.sql<
			Array<{ status: PartnerActivationStatus; count: number }>
		>`
			SELECT status, COUNT(*)::int AS count
			FROM app_partner_activation_queue
			GROUP BY status
		`;
		const summary = {
			total: 0,
			pending: 0,
			processing: 0,
			activated: 0,
			dismissed: 0,
		};
		for (const row of rows) {
			summary.total += row.count;
			if (row.status === "pending") summary.pending = row.count;
			if (row.status === "processing") summary.processing = row.count;
			if (row.status === "activated") summary.activated = row.count;
			if (row.status === "dismissed") summary.dismissed = row.count;
		}
		return summary;
	}

	async getPendingNotificationSummary(): Promise<{
		count: number;
		oldestCreatedAt: string | null;
		newestCreatedAt: string | null;
	}> {
		await this.ready();
		const rows = await this.sql<
			{
				count: number;
				oldest_created_at: Date | string | null;
				newest_created_at: Date | string | null;
			}[]
		>`
			SELECT
				COUNT(*)::int AS count,
				MIN(created_at) AS oldest_created_at,
				MAX(created_at) AS newest_created_at
			FROM app_partner_activation_queue
			WHERE status = 'pending'
		`;

		const row = rows[0];
		return {
			count: row?.count ?? 0,
			oldestCreatedAt: toNullableIsoString(row?.oldest_created_at ?? null),
			newestCreatedAt: toNullableIsoString(row?.newest_created_at ?? null),
		};
	}

	async replaceAll(records: PartnerActivationRecord[]): Promise<void> {
		await this.ready();
		await this.sql`DELETE FROM app_partner_activation_queue`;
		if (records.length === 0) return;

		const rows = records.map((record) => ({
			id: record.id,
			source: record.source,
			source_event_id: record.sourceEventId,
			status: record.status,
			package_key: record.packageKey,
			payment_link_id: record.paymentLinkId,
			stripe_session_id: record.stripeSessionId,
			customer_email: record.customerEmail,
			customer_name: record.customerName,
			event_name: record.eventName,
			event_url: record.eventUrl,
			amount_total_cents: record.amountTotalCents,
			currency: record.currency,
			notes: record.notes,
			metadata: toJsonValue(toJsonObjectForSql(record.metadata)),
			raw_payload: toJsonValue(toJsonObjectForSql(record.rawPayload)),
			fulfilled_event_key: record.fulfilledEventKey,
			fulfilled_tier: record.fulfilledTier,
			fulfilled_start_at: record.fulfilledStartAt,
			fulfilled_end_at: record.fulfilledEndAt,
			partner_stats_token: record.partnerStatsToken,
			partner_stats_revoked_at: record.partnerStatsRevokedAt,
			created_at: record.createdAt,
			updated_at: record.updatedAt,
			activated_at: record.activatedAt,
		}));

		await this.sql`
			INSERT INTO app_partner_activation_queue ${this.sql(
				rows,
				"id",
				"source",
				"source_event_id",
				"status",
				"package_key",
				"payment_link_id",
				"stripe_session_id",
				"customer_email",
				"customer_name",
				"event_name",
				"event_url",
				"amount_total_cents",
				"currency",
				"notes",
				"metadata",
				"raw_payload",
				"fulfilled_event_key",
				"fulfilled_tier",
				"fulfilled_start_at",
				"fulfilled_end_at",
				"partner_stats_token",
				"partner_stats_revoked_at",
				"created_at",
				"updated_at",
				"activated_at",
			)}
		`;
	}
}

export const getPartnerActivationRepository =
	(): PartnerActivationRepository | null => {
		if (
			globalThis.__ooocFeteFinderPartnerActivationRepository &&
			globalThis.__ooocFeteFinderPartnerActivationRepository instanceof
				PartnerActivationRepository
		) {
			return globalThis.__ooocFeteFinderPartnerActivationRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new PartnerActivationRepository(sql);
		globalThis.__ooocFeteFinderPartnerActivationRepository = repository;
		return repository;
	};
