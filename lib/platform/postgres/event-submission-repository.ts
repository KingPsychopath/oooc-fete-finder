import "server-only";

import { randomUUID } from "crypto";
import type { Sql } from "postgres";
import type {
	CreateEventSubmissionInput,
	EventSubmissionMetrics,
	EventSubmissionPayload,
	EventSubmissionRecord,
	EventSubmissionSpamSignals,
	EventSubmissionStatus,
	ReviewEventSubmissionInput,
} from "@/features/events/submissions/types";
import { getPostgresClient } from "./postgres-client";

const TABLE_NAME = "app_event_submissions";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

declare global {
	var __ooocFeteFinderEventSubmissionRepository:
		| EventSubmissionRepository
		| undefined;
}

type EventSubmissionRow = {
	id: string;
	status: EventSubmissionStatus;
	payload: unknown;
	host_email: string;
	source_ip_hash: string;
	email_ip_hash: string;
	fingerprint_hash: string;
	spam_signals: unknown;
	review_reason: string | null;
	accepted_event_key: string | null;
	reviewed_at: Date | string | null;
	reviewed_by: string | null;
	created_at: Date | string;
	updated_at: Date | string;
};

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value: Date | string | null): string | null => {
	if (!value) return null;
	return toIsoString(value);
};

const toJsonValue = (value: unknown): JsonValue => {
	if (value == null) {
		return null;
	}
	return JSON.parse(JSON.stringify(value)) as JsonValue;
};

const toPayload = (value: unknown): EventSubmissionPayload => {
	if (!value || typeof value !== "object") {
		throw new Error("Invalid submission payload in storage");
	}

	const record = value as Partial<EventSubmissionPayload>;
	if (
		typeof record.eventName !== "string" ||
		typeof record.date !== "string" ||
		typeof record.startTime !== "string" ||
		typeof record.location !== "string" ||
		typeof record.hostEmail !== "string" ||
		typeof record.proofLink !== "string" ||
		typeof record.submittedAt !== "string"
	) {
		throw new Error("Stored submission payload is missing required fields");
	}

	return {
		eventName: record.eventName,
		date: record.date,
		startTime: record.startTime,
		location: record.location,
		hostEmail: record.hostEmail,
		proofLink: record.proofLink,
		submittedAt: record.submittedAt,
		endTime: typeof record.endTime === "string" ? record.endTime : undefined,
		genre: typeof record.genre === "string" ? record.genre : undefined,
		price: typeof record.price === "string" ? record.price : undefined,
		age: typeof record.age === "string" ? record.age : undefined,
		indoorOutdoor:
			typeof record.indoorOutdoor === "string" ? record.indoorOutdoor : undefined,
		notes: typeof record.notes === "string" ? record.notes : undefined,
		arrondissement:
			typeof record.arrondissement === "string" ? record.arrondissement : undefined,
	};
};

const toSpamSignals = (value: unknown): EventSubmissionSpamSignals => {
	if (!value || typeof value !== "object") {
		return {
			honeypotFilled: false,
			completedTooFast: false,
			completionSeconds: null,
			reasons: [],
		};
	}

	const record = value as Partial<EventSubmissionSpamSignals>;
	return {
		honeypotFilled: Boolean(record.honeypotFilled),
		completedTooFast: Boolean(record.completedTooFast),
		completionSeconds:
			typeof record.completionSeconds === "number" &&
			Number.isFinite(record.completionSeconds)
				? record.completionSeconds
				: null,
		reasons: Array.isArray(record.reasons)
			? record.reasons.filter((reason): reason is string => typeof reason === "string")
			: [],
	};
};

const toRecord = (row: EventSubmissionRow): EventSubmissionRecord => ({
	id: row.id,
	status: row.status,
	payload: toPayload(row.payload),
	hostEmail: row.host_email,
	sourceIpHash: row.source_ip_hash,
	emailIpHash: row.email_ip_hash,
	fingerprintHash: row.fingerprint_hash,
	spamSignals: toSpamSignals(row.spam_signals),
	reviewReason: row.review_reason,
	acceptedEventKey: row.accepted_event_key,
	reviewedAt: toNullableIsoString(row.reviewed_at),
	reviewedBy: row.reviewed_by,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
});

export class EventSubmissionRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_submissions (
				id TEXT PRIMARY KEY,
				status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
				payload JSONB NOT NULL,
				host_email TEXT NOT NULL,
				source_ip_hash TEXT NOT NULL,
				email_ip_hash TEXT NOT NULL,
				fingerprint_hash TEXT NOT NULL,
				spam_signals JSONB NOT NULL,
				review_reason TEXT,
				accepted_event_key TEXT,
				reviewed_at TIMESTAMPTZ,
				reviewed_by TEXT DEFAULT 'admin-panel',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_submissions_status_created_at
			ON app_event_submissions (status, created_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_submissions_fingerprint_hash_created_at
			ON app_event_submissions (fingerprint_hash, created_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_submissions_host_email_created_at
			ON app_event_submissions (host_email, created_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async createSubmission(
		input: CreateEventSubmissionInput,
	): Promise<EventSubmissionRecord> {
		await this.ready();
		const id = randomUUID();
		const nowIso = new Date().toISOString();
		const rows = await this.sql<EventSubmissionRow[]>`
			INSERT INTO app_event_submissions (
				id,
				status,
				payload,
				host_email,
				source_ip_hash,
				email_ip_hash,
				fingerprint_hash,
				spam_signals,
				review_reason,
				accepted_event_key,
				reviewed_at,
				reviewed_by,
				created_at,
				updated_at
			)
			VALUES (
				${id},
				${input.status},
				${this.sql.json(toJsonValue(input.payload))},
				${input.hostEmail},
				${input.sourceIpHash},
				${input.emailIpHash},
				${input.fingerprintHash},
				${this.sql.json(toJsonValue(input.spamSignals))},
				${input.reviewReason ?? null},
				${input.acceptedEventKey ?? null},
				${input.reviewedAt ?? null},
				${input.reviewedBy ?? null},
				${nowIso},
				${nowIso}
			)
			RETURNING
				id,
				status,
				payload,
				host_email,
				source_ip_hash,
				email_ip_hash,
				fingerprint_hash,
				spam_signals,
				review_reason,
				accepted_event_key,
				reviewed_at,
				reviewed_by,
				created_at,
				updated_at
		`;

		const row = rows[0];
		if (!row) {
			throw new Error("Failed to insert event submission");
		}

		return toRecord(row);
	}

	async listSubmissionsByStatus(
		status: EventSubmissionStatus,
		limit = 100,
	): Promise<EventSubmissionRecord[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(limit, 500));
		const rows = await this.sql<EventSubmissionRow[]>`
			SELECT
				id,
				status,
				payload,
				host_email,
				source_ip_hash,
				email_ip_hash,
				fingerprint_hash,
				spam_signals,
				review_reason,
				accepted_event_key,
				reviewed_at,
				reviewed_by,
				created_at,
				updated_at
			FROM app_event_submissions
			WHERE status = ${status}
			ORDER BY created_at DESC
			LIMIT ${safeLimit}
		`;
		return rows.map(toRecord);
	}

	async getSubmissionById(id: string): Promise<EventSubmissionRecord | null> {
		await this.ready();
		const rows = await this.sql<EventSubmissionRow[]>`
			SELECT
				id,
				status,
				payload,
				host_email,
				source_ip_hash,
				email_ip_hash,
				fingerprint_hash,
				spam_signals,
				review_reason,
				accepted_event_key,
				reviewed_at,
				reviewed_by,
				created_at,
				updated_at
			FROM app_event_submissions
			WHERE id = ${id}
			LIMIT 1
		`;
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async reviewPendingSubmission(
		input: ReviewEventSubmissionInput,
	): Promise<EventSubmissionRecord | null> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const reviewReason = input.reviewReason?.trim() || null;
		const reviewedBy = input.reviewedBy?.trim() || "admin-panel";
		const acceptedEventKey = input.acceptedEventKey?.trim() || null;
		const rows = await this.sql<EventSubmissionRow[]>`
			UPDATE app_event_submissions
			SET
				status = ${input.status},
				review_reason = ${reviewReason},
				accepted_event_key = ${acceptedEventKey},
				reviewed_at = ${nowIso},
				reviewed_by = ${reviewedBy},
				updated_at = ${nowIso}
			WHERE id = ${input.id}
				AND status = 'pending'
			RETURNING
				id,
				status,
				payload,
				host_email,
				source_ip_hash,
				email_ip_hash,
				fingerprint_hash,
				spam_signals,
				review_reason,
				accepted_event_key,
				reviewed_at,
				reviewed_by,
				created_at,
				updated_at
		`;

		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async getMetrics(windowDays = 7): Promise<EventSubmissionMetrics> {
		await this.ready();
		const safeWindowDays = Math.max(1, Math.min(windowDays, 90));
		const rows = await this.sql<
			{
				total_count: number;
				pending_count: number;
				accepted_last_window: number;
				declined_last_window: number;
			}[]
		>`
			SELECT
				COUNT(*)::int AS total_count,
				COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
				COUNT(*) FILTER (
					WHERE status = 'accepted'
						AND reviewed_at >= NOW() - (${safeWindowDays} * INTERVAL '1 day')
				)::int AS accepted_last_window,
				COUNT(*) FILTER (
					WHERE status = 'declined'
						AND reviewed_at >= NOW() - (${safeWindowDays} * INTERVAL '1 day')
				)::int AS declined_last_window
			FROM app_event_submissions
		`;

		const row = rows[0];
		return {
			totalCount: row?.total_count ?? 0,
			pendingCount: row?.pending_count ?? 0,
			acceptedLast7Days: row?.accepted_last_window ?? 0,
			declinedLast7Days: row?.declined_last_window ?? 0,
		};
	}

	getTableName(): string {
		return TABLE_NAME;
	}
}

export const getEventSubmissionRepository = (): EventSubmissionRepository | null => {
	const sql = getPostgresClient();
	if (!sql) return null;

	if (!globalThis.__ooocFeteFinderEventSubmissionRepository) {
		globalThis.__ooocFeteFinderEventSubmissionRepository =
			new EventSubmissionRepository(sql);
	}

	return globalThis.__ooocFeteFinderEventSubmissionRepository;
};

export const getEventSubmissionTableName = (): string => TABLE_NAME;
