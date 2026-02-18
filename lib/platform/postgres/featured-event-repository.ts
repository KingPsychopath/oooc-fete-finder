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
		typeof candidate.clearAllEntries === "function"
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
		const statuses = options?.statuses?.length ? options.statuses : null;

		const rows = await this.sql<FeatureScheduleRow[]>`
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
			${statuses ? this.sql`WHERE status = ANY(${statuses})` : this.sql``}
			ORDER BY effective_start_at ASC, created_at ASC, event_key ASC, id ASC
		`;

		return rows.map(toEntry);
	}

	async createScheduledEntry(input: {
		eventKey: string;
		requestedStartAt: string;
		durationHours: number;
		createdBy: string;
	}): Promise<FeaturedScheduleEntry> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const id = randomUUID();

		const rows = await this.sql<FeatureScheduleRow[]>`
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
	}

	async rescheduleEntry(input: {
		id: string;
		requestedStartAt: string;
		durationHours: number;
	}): Promise<boolean> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const rows = await this.sql<{ id: string }[]>`
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
	}

	async cancelEntry(id: string): Promise<boolean> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const rows = await this.sql<{ id: string }[]>`
			UPDATE app_featured_event_schedule
			SET status = 'cancelled', updated_at = ${nowIso}
			WHERE id = ${id}
			RETURNING id
		`;
		return rows.length > 0;
	}

	async markCompletedEntries(nowIso: string): Promise<number> {
		await this.ready();
		const rows = await this.sql<{ id: string }[]>`
			UPDATE app_featured_event_schedule
			SET status = 'completed', updated_at = ${nowIso}
			WHERE status = 'scheduled'
				AND effective_end_at < ${nowIso}
			RETURNING id
		`;
		return rows.length;
	}

	async reviveZeroDurationCompletedEntries(): Promise<number> {
		await this.ready();
		const nowIso = new Date().toISOString();
		const rows = await this.sql<{ id: string }[]>`
			UPDATE app_featured_event_schedule
			SET status = 'scheduled', updated_at = ${nowIso}
			WHERE status = 'completed'
				AND effective_end_at = effective_start_at
			RETURNING id
		`;
		return rows.length;
	}

	async updateComputedWindows(
		windows: Array<{
			id: string;
			effectiveStartAt: string;
			effectiveEndAt: string;
		}>,
	): Promise<void> {
		await this.ready();
		if (windows.length === 0) return;

		const nowIso = new Date().toISOString();
		for (const window of windows) {
			await this.sql`
				UPDATE app_featured_event_schedule
				SET
					effective_start_at = ${window.effectiveStartAt},
					effective_end_at = ${window.effectiveEndAt},
					updated_at = ${nowIso}
				WHERE id = ${window.id}
			`;
		}
	}

	async clearAllEntries(): Promise<number> {
		await this.ready();
		const rows = await this.sql<{ id: string }[]>`
			DELETE FROM app_featured_event_schedule
			RETURNING id
		`;
		return rows.length;
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
