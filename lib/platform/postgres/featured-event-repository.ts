import "server-only";

import { randomUUID } from "crypto";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";
import type {
	FeaturedScheduleEntry,
	FeaturedScheduleStatus,
} from "@/features/events/featured/types";

type FeatureScheduleRow = {
	id: string;
	event_key: string;
	requested_start_at: Date | string;
	effective_start_at: Date | string;
	effective_end_at: Date | string;
	duration_hours: number;
	status: FeaturedScheduleStatus;
	created_by: string;
	created_at: Date | string;
	updated_at: Date | string;
};

declare global {
	var __ooocFeteFinderFeaturedEventRepository:
		| FeaturedEventRepository
		| undefined;
}

type FeaturedRepositorySqlClient = Sql;

export interface FeaturedEventRepositorySession {
	listEntries(options?: {
		statuses?: FeaturedScheduleStatus[];
	}): Promise<FeaturedScheduleEntry[]>;
	createScheduledEntry(input: {
		eventKey: string;
		requestedStartAt: string;
		durationHours: number;
		createdBy: string;
	}): Promise<FeaturedScheduleEntry>;
	rescheduleEntry(input: {
		id: string;
		requestedStartAt: string;
		durationHours: number;
	}): Promise<boolean>;
	cancelEntry(id: string): Promise<boolean>;
	markCompletedEntries(nowIso: string): Promise<number>;
	reviveZeroDurationCompletedEntries(): Promise<number>;
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
	replaceAllEntries(entries: FeaturedScheduleEntry[]): Promise<void>;
}

const hasRequiredRepositoryMethods = (
	repository: unknown,
): repository is FeaturedEventRepository => {
	if (!repository || typeof repository !== "object") return false;
	const candidate = repository as Record<string, unknown>;
	return (
		typeof candidate.listEntries === "function" &&
		typeof candidate.createScheduledEntry === "function" &&
		typeof candidate.rescheduleEntry === "function" &&
		typeof candidate.cancelEntry === "function" &&
		typeof candidate.markCompletedEntries === "function" &&
		typeof candidate.updateComputedWindows === "function" &&
		typeof candidate.reviveZeroDurationCompletedEntries === "function" &&
		typeof candidate.clearScheduledEntries === "function" &&
		typeof candidate.clearHistoryEntries === "function" &&
		typeof candidate.clearAllEntries === "function" &&
		typeof candidate.replaceAllEntries === "function" &&
		typeof candidate.withScheduleLock === "function"
	);
};

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toEntry = (row: FeatureScheduleRow): FeaturedScheduleEntry => ({
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

const SCHEDULE_LOCK_NAMESPACE = 9297;
const SCHEDULE_LOCK_KEY = 1;

const listEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
	options?: {
		statuses?: FeaturedScheduleStatus[];
	},
): Promise<FeaturedScheduleEntry[]> => {
	const statuses = options?.statuses?.length ? options.statuses : null;

	const rows = await sqlClient<FeatureScheduleRow[]>`
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
		FROM app_featured_event_schedule
		${statuses ? sqlClient`WHERE status = ANY(${statuses})` : sqlClient``}
		ORDER BY effective_start_at ASC, created_at ASC, event_key ASC, id ASC
	`;

	return rows.map(toEntry);
};

const createScheduledEntryWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
	input: {
		eventKey: string;
		requestedStartAt: string;
		durationHours: number;
		createdBy: string;
	},
): Promise<FeaturedScheduleEntry> => {
	const nowIso = new Date().toISOString();
	const id = randomUUID();

	const rows = await sqlClient<FeatureScheduleRow[]>`
		INSERT INTO app_featured_event_schedule (
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
	sqlClient: FeaturedRepositorySqlClient,
	input: {
		id: string;
		requestedStartAt: string;
		durationHours: number;
	},
): Promise<boolean> => {
	const nowIso = new Date().toISOString();
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_featured_event_schedule
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
	sqlClient: FeaturedRepositorySqlClient,
	id: string,
): Promise<boolean> => {
	const nowIso = new Date().toISOString();
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_featured_event_schedule
		SET status = 'cancelled', updated_at = ${nowIso}
		WHERE id = ${id}
		RETURNING id
	`;
	return rows.length > 0;
};

const markCompletedEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
	nowIso: string,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_featured_event_schedule
		SET status = 'completed', updated_at = ${nowIso}
		WHERE status = 'scheduled'
			AND effective_end_at < ${nowIso}
		RETURNING id
	`;
	return rows.length;
};

const reviveZeroDurationCompletedEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
): Promise<number> => {
	const nowIso = new Date().toISOString();
	const rows = await sqlClient<{ id: string }[]>`
		UPDATE app_featured_event_schedule
		SET status = 'scheduled', updated_at = ${nowIso}
		WHERE status = 'completed'
			AND effective_end_at = effective_start_at
		RETURNING id
	`;
	return rows.length;
};

const updateComputedWindowsWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
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
			UPDATE app_featured_event_schedule
			SET
				effective_start_at = ${window.effectiveStartAt},
				effective_end_at = ${window.effectiveEndAt},
				updated_at = ${nowIso}
			WHERE id = ${window.id}
		`;
	}
};

const clearAllEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		DELETE FROM app_featured_event_schedule
		RETURNING id
	`;
	return rows.length;
};

const clearScheduledEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		DELETE FROM app_featured_event_schedule
		WHERE status = 'scheduled'
		RETURNING id
	`;
	return rows.length;
};

const clearHistoryEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
): Promise<number> => {
	const rows = await sqlClient<{ id: string }[]>`
		DELETE FROM app_featured_event_schedule
		WHERE status IN ('completed', 'cancelled')
		RETURNING id
	`;
	return rows.length;
};

const replaceAllEntriesWithClient = async (
	sqlClient: FeaturedRepositorySqlClient,
	entries: FeaturedScheduleEntry[],
): Promise<void> => {
	await sqlClient`DELETE FROM app_featured_event_schedule`;
	if (entries.length === 0) return;

	const rows = entries.map((entry) => ({
		id: entry.id,
		event_key: entry.eventKey,
		requested_start_at: entry.requestedStartAt,
		effective_start_at: entry.effectiveStartAt,
		effective_end_at: entry.effectiveEndAt,
		duration_hours: entry.durationHours,
		status: entry.status,
		created_by: entry.createdBy,
		created_at: entry.createdAt,
		updated_at: entry.updatedAt,
	}));

	await sqlClient`
		INSERT INTO app_featured_event_schedule ${sqlClient(
			rows,
			"id",
			"event_key",
			"requested_start_at",
			"effective_start_at",
			"effective_end_at",
			"duration_hours",
			"status",
			"created_by",
			"created_at",
			"updated_at",
		)}
	`;
};

const createRepositorySession = (
	sqlClient: FeaturedRepositorySqlClient,
): FeaturedEventRepositorySession => ({
	listEntries: (options) => listEntriesWithClient(sqlClient, options),
	createScheduledEntry: (input) =>
		createScheduledEntryWithClient(sqlClient, input),
	rescheduleEntry: (input) => rescheduleEntryWithClient(sqlClient, input),
	cancelEntry: (id) => cancelEntryWithClient(sqlClient, id),
	markCompletedEntries: (nowIso) =>
		markCompletedEntriesWithClient(sqlClient, nowIso),
	reviveZeroDurationCompletedEntries: () =>
		reviveZeroDurationCompletedEntriesWithClient(sqlClient),
	updateComputedWindows: (windows) =>
		updateComputedWindowsWithClient(sqlClient, windows),
	clearScheduledEntries: () => clearScheduledEntriesWithClient(sqlClient),
	clearHistoryEntries: () => clearHistoryEntriesWithClient(sqlClient),
	clearAllEntries: () => clearAllEntriesWithClient(sqlClient),
	replaceAllEntries: (entries) => replaceAllEntriesWithClient(sqlClient, entries),
});

export class FeaturedEventRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_featured_event_schedule (
				id TEXT PRIMARY KEY,
				event_key TEXT NOT NULL,
				requested_start_at TIMESTAMPTZ NOT NULL,
				effective_start_at TIMESTAMPTZ NOT NULL,
				effective_end_at TIMESTAMPTZ NOT NULL,
				duration_hours INTEGER NOT NULL DEFAULT 48 CHECK (duration_hours BETWEEN 1 AND 168),
				status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
				created_by TEXT NOT NULL DEFAULT 'admin',
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_featured_event_schedule_effective
			ON app_featured_event_schedule (status, effective_start_at ASC, effective_end_at ASC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_featured_event_schedule_event_key
			ON app_featured_event_schedule (event_key)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_featured_event_schedule_requested
			ON app_featured_event_schedule (requested_start_at ASC, created_at ASC, event_key ASC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async listEntries(options?: {
		statuses?: FeaturedScheduleStatus[];
	}): Promise<FeaturedScheduleEntry[]> {
		await this.ready();
		return listEntriesWithClient(this.sql, options);
	}

	async createScheduledEntry(input: {
		eventKey: string;
		requestedStartAt: string;
		durationHours: number;
		createdBy: string;
	}): Promise<FeaturedScheduleEntry> {
		await this.ready();
		return createScheduledEntryWithClient(this.sql, input);
	}

	async rescheduleEntry(input: {
		id: string;
		requestedStartAt: string;
		durationHours: number;
	}): Promise<boolean> {
		await this.ready();
		return rescheduleEntryWithClient(this.sql, input);
	}

	async cancelEntry(id: string): Promise<boolean> {
		await this.ready();
		return cancelEntryWithClient(this.sql, id);
	}

	async markCompletedEntries(nowIso: string): Promise<number> {
		await this.ready();
		return markCompletedEntriesWithClient(this.sql, nowIso);
	}

	async reviveZeroDurationCompletedEntries(): Promise<number> {
		await this.ready();
		return reviveZeroDurationCompletedEntriesWithClient(this.sql);
	}

	async updateComputedWindows(
		windows: Array<{
			id: string;
			effectiveStartAt: string;
			effectiveEndAt: string;
		}>,
	): Promise<void> {
		await this.ready();
		await updateComputedWindowsWithClient(this.sql, windows);
	}

	async clearAllEntries(): Promise<number> {
		await this.ready();
		return clearAllEntriesWithClient(this.sql);
	}

	async clearScheduledEntries(): Promise<number> {
		await this.ready();
		return clearScheduledEntriesWithClient(this.sql);
	}

	async clearHistoryEntries(): Promise<number> {
		await this.ready();
		return clearHistoryEntriesWithClient(this.sql);
	}

	async replaceAllEntries(entries: FeaturedScheduleEntry[]): Promise<void> {
		await this.ready();
		await this.withScheduleLock(async (session) => {
			await session.replaceAllEntries(entries);
		});
	}

	async withScheduleLock<T>(
		operation: (session: FeaturedEventRepositorySession) => Promise<T>,
	): Promise<T> {
		await this.ready();
		return this.sql.begin(async (transactionSql) => {
			const lockedSql = transactionSql as unknown as Sql;
			await lockedSql`
				SELECT pg_advisory_xact_lock(${SCHEDULE_LOCK_NAMESPACE}, ${SCHEDULE_LOCK_KEY})
			`;
			return operation(createRepositorySession(lockedSql));
		}) as Promise<T>;
	}
}

export const getFeaturedEventRepository =
	(): FeaturedEventRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (
			!hasRequiredRepositoryMethods(
				globalThis.__ooocFeteFinderFeaturedEventRepository,
			)
		) {
			globalThis.__ooocFeteFinderFeaturedEventRepository =
				new FeaturedEventRepository(sql);
		}

		return globalThis.__ooocFeteFinderFeaturedEventRepository;
	};
