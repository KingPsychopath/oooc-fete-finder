import "server-only";

import { randomUUID } from "crypto";
import type {
	PromotedScheduleEntry,
	PromotedScheduleStatus,
} from "@/features/events/promoted/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

type PromotedScheduleRow = {
	id: string;
	event_key: string;
	requested_start_at: Date | string;
	effective_start_at: Date | string;
	effective_end_at: Date | string;
	duration_hours: number;
	status: PromotedScheduleStatus;
	created_by: string;
	created_at: Date | string;
	updated_at: Date | string;
};

declare global {
	var __ooocFeteFinderPromotedEventRepository:
		| PromotedEventRepository
		| undefined;
}

type PromotedRepositorySqlClient = Sql;

export interface PromotedEventRepositorySession {
	listEntries(options?: {
		statuses?: PromotedScheduleStatus[];
	}): Promise<PromotedScheduleEntry[]>;
	createScheduledEntry(input: {
		eventKey: string;
		requestedStartAt: string;
		durationHours: number;
		createdBy: string;
	}): Promise<PromotedScheduleEntry>;
	rescheduleEntry(input: {
		id: string;
		requestedStartAt: string;
		durationHours: number;
	}): Promise<boolean>;
	cancelEntry(id: string): Promise<boolean>;
	markCompletedEntries(nowIso: string): Promise<number>;
	updateComputedWindows(
		windows: Array<{
			id: string;
			effectiveStartAt: string;
			effectiveEndAt: string;
		}>,
	): Promise<void>;
	clearScheduledEntries(): Promise<number>;
	clearHistoryEntries(): Promise<number>;
	clearAllEntries(): Promise<number>;
}

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toEntry = (row: PromotedScheduleRow): PromotedScheduleEntry => ({
	id: row.id,
	eventKey: row.event_key,
	requestedStartAt: toIsoString(row.requested_start_at),
	effectiveStartAt: toIsoString(row.effective_start_at),
	effectiveEndAt: toIsoString(row.effective_end_at),
	durationHours: row.duration_hours,
	status: row.status,
	createdBy: row.created_by,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
});

const SCHEDULE_LOCK_NAMESPACE = 9317;
const SCHEDULE_LOCK_KEY = 1;

const listEntriesWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
	options?: {
		statuses?: PromotedScheduleStatus[];
	},
): Promise<PromotedScheduleEntry[]> => {
	const statuses = options?.statuses?.length ? options.statuses : null;
	const rows = await sqlClient<PromotedScheduleRow[]>`
		SELECT
			id,
			event_key,
			requested_start_at,
			effective_start_at,
			effective_end_at,
			duration_hours,
			status,
			created_by,
			created_at,
			updated_at
		FROM app_promoted_event_schedule
		${statuses ? sqlClient`WHERE status = ANY(${statuses})` : sqlClient``}
		ORDER BY effective_start_at ASC, created_at ASC, event_key ASC, id ASC
	`;
	return rows.map(toEntry);
};

const createScheduledEntryWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
	input: {
		eventKey: string;
		requestedStartAt: string;
		durationHours: number;
		createdBy: string;
	},
): Promise<PromotedScheduleEntry> => {
	const nowIso = new Date().toISOString();
	const id = randomUUID();
	const rows = await sqlClient<PromotedScheduleRow[]>`
		INSERT INTO app_promoted_event_schedule (
			id,
			event_key,
			requested_start_at,
			effective_start_at,
			effective_end_at,
			duration_hours,
			status,
			created_by,
			created_at,
			updated_at
		)
		VALUES (
			${id},
			${input.eventKey},
			${input.requestedStartAt},
			${input.requestedStartAt},
			${input.requestedStartAt},
			${input.durationHours},
			'scheduled',
			${input.createdBy},
			${nowIso},
			${nowIso}
		)
		RETURNING
			id,
			event_key,
			requested_start_at,
			effective_start_at,
			effective_end_at,
			duration_hours,
			status,
			created_by,
			created_at,
			updated_at
	`;
	return toEntry(rows[0]);
};

const rescheduleEntryWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
	input: {
		id: string;
		requestedStartAt: string;
		durationHours: number;
	},
): Promise<boolean> => {
	const nowIso = new Date().toISOString();
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_promoted_event_schedule
		SET
			requested_start_at = ${input.requestedStartAt},
			duration_hours = ${input.durationHours},
			status = 'scheduled',
			updated_at = ${nowIso}
		WHERE id = ${input.id}
		RETURNING id
	`;
	return rows.length > 0;
};

const cancelEntryWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
	id: string,
): Promise<boolean> => {
	const nowIso = new Date().toISOString();
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_promoted_event_schedule
		SET status = 'cancelled', updated_at = ${nowIso}
		WHERE id = ${id}
		RETURNING id
	`;
	return rows.length > 0;
};

const markCompletedEntriesWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
	nowIso: string,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_promoted_event_schedule
		SET status = 'completed', updated_at = ${nowIso}
		WHERE status = 'scheduled'
			AND effective_end_at < ${nowIso}
		RETURNING id
	`;
	return rows.length;
};

const updateComputedWindowsWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
	windows: Array<{
		id: string;
		effectiveStartAt: string;
		effectiveEndAt: string;
	}>,
): Promise<void> => {
	if (windows.length === 0) return;
	const nowIso = new Date().toISOString();
	for (const window of windows) {
		await sqlClient`
			UPDATE app_promoted_event_schedule
			SET
				effective_start_at = ${window.effectiveStartAt},
				effective_end_at = ${window.effectiveEndAt},
				updated_at = ${nowIso}
			WHERE id = ${window.id}
		`;
	}
};

const clearScheduledEntriesWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		DELETE FROM app_promoted_event_schedule
		WHERE status = 'scheduled'
		RETURNING id
	`;
	return rows.length;
};

const clearHistoryEntriesWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		DELETE FROM app_promoted_event_schedule
		WHERE status <> 'scheduled'
		RETURNING id
	`;
	return rows.length;
};

const clearAllEntriesWithClient = async (
	sqlClient: PromotedRepositorySqlClient,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		DELETE FROM app_promoted_event_schedule
		RETURNING id
	`;
	return rows.length;
};

const buildSession = (
	sqlClient: PromotedRepositorySqlClient,
): PromotedEventRepositorySession => ({
	listEntries: (options) => listEntriesWithClient(sqlClient, options),
	createScheduledEntry: (input) =>
		createScheduledEntryWithClient(sqlClient, input),
	rescheduleEntry: (input) => rescheduleEntryWithClient(sqlClient, input),
	cancelEntry: (id) => cancelEntryWithClient(sqlClient, id),
	markCompletedEntries: (nowIso) =>
		markCompletedEntriesWithClient(sqlClient, nowIso),
	updateComputedWindows: (windows) =>
		updateComputedWindowsWithClient(sqlClient, windows),
	clearScheduledEntries: () => clearScheduledEntriesWithClient(sqlClient),
	clearHistoryEntries: () => clearHistoryEntriesWithClient(sqlClient),
	clearAllEntries: () => clearAllEntriesWithClient(sqlClient),
});

export class PromotedEventRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_promoted_event_schedule (
				id TEXT PRIMARY KEY,
				event_key TEXT NOT NULL,
				requested_start_at TIMESTAMPTZ NOT NULL,
				effective_start_at TIMESTAMPTZ NOT NULL,
				effective_end_at TIMESTAMPTZ NOT NULL,
				duration_hours INTEGER NOT NULL CHECK (duration_hours >= 1 AND duration_hours <= 168),
				status TEXT NOT NULL CHECK (status IN ('scheduled', 'cancelled', 'completed')),
				created_by TEXT NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_promoted_event_schedule_status_start
			ON app_promoted_event_schedule (status, effective_start_at ASC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async listEntries(options?: {
		statuses?: PromotedScheduleStatus[];
	}): Promise<PromotedScheduleEntry[]> {
		await this.ready();
		return listEntriesWithClient(this.sql, options);
	}

	async withScheduleLock<T>(
		operation: (session: PromotedEventRepositorySession) => Promise<T>,
	): Promise<T> {
		await this.ready();
		return this.sql.begin(async (transactionSql) => {
			const lockedSql = transactionSql as unknown as Sql;
			await lockedSql`
				SELECT pg_advisory_xact_lock(${SCHEDULE_LOCK_NAMESPACE}, ${SCHEDULE_LOCK_KEY})
			`;
			return operation(buildSession(lockedSql));
		}) as Promise<T>;
	}
}

export const getPromotedEventRepository =
	(): PromotedEventRepository | null => {
		if (globalThis.__ooocFeteFinderPromotedEventRepository) {
			return globalThis.__ooocFeteFinderPromotedEventRepository;
		}
		const sql = getPostgresClient();
		if (!sql) return null;
		const repository = new PromotedEventRepository(sql);
		globalThis.__ooocFeteFinderPromotedEventRepository = repository;
		return repository;
	};
