import "server-only";

import { randomUUID } from "crypto";
import type {
	EventSheetRevisionInput,
	EventSheetRevisionRecord,
	EventSheetRevisionSnapshot,
	EventSheetRevisionTrigger,
} from "@/features/data-management/event-sheet-revision-types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderEventSheetRevisionRepository:
		| EventSheetRevisionRepository
		| undefined;
}

type EventSheetRevisionRow = {
	id: string;
	group_id: string;
	trigger: EventSheetRevisionTrigger;
	created_at: Date | string;
	updated_at: Date | string;
	actor_label: string;
	actor_session_jti: string | null;
	row_count: number;
	column_count: number;
	added_rows: number;
	deleted_rows: number;
	changed_rows: number;
	changed_columns: unknown;
	sample_added: unknown;
	sample_deleted: unknown;
	autosave_count: number;
	summary: string;
	href: string | null;
	csv_content: string | null;
};

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toStringArray = (value: unknown): string[] => {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
};

const uniqueStrings = (values: string[], limit: number): string[] =>
	Array.from(
		new Set(values.map((value) => value.trim()).filter(Boolean)),
	).slice(0, limit);

const toRecord = (row: EventSheetRevisionRow): EventSheetRevisionRecord => ({
	id: row.id,
	groupId: row.group_id,
	trigger: row.trigger,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
	actorLabel: row.actor_label,
	actorSessionJti: row.actor_session_jti,
	rowCount: row.row_count,
	columnCount: row.column_count,
	addedRows: row.added_rows,
	deletedRows: row.deleted_rows,
	changedRows: row.changed_rows,
	changedColumns: toStringArray(row.changed_columns),
	sampleAdded: toStringArray(row.sample_added),
	sampleDeleted: toStringArray(row.sample_deleted),
	autosaveCount: row.autosave_count,
	summary: row.summary,
	href: row.href,
	canRestore: Boolean(row.csv_content),
});

const formatSummary = (
	trigger: EventSheetRevisionTrigger,
	input: Pick<
		EventSheetRevisionInput,
		"addedRows" | "deletedRows" | "changedRows" | "rowCount"
	>,
): string => {
	const parts = [
		input.addedRows > 0 ? `${input.addedRows} added` : null,
		input.deletedRows > 0 ? `${input.deletedRows} deleted` : null,
		input.changedRows > 0 ? `${input.changedRows} changed` : null,
	].filter((part): part is string => Boolean(part));
	const prefix = trigger === "publish" ? "Published" : "Autosaved";
	return parts.length > 0
		? `${prefix} event sheet: ${parts.join(", ")}`
		: `${prefix} event sheet (${input.rowCount} rows)`;
};

export class EventSheetRevisionRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_sheet_revisions (
				id TEXT PRIMARY KEY,
				group_id TEXT NOT NULL,
				trigger TEXT NOT NULL CHECK (trigger IN ('autosave', 'publish')),
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				actor_label TEXT NOT NULL,
				actor_session_jti TEXT NULL,
				row_count INTEGER NOT NULL DEFAULT 0,
				column_count INTEGER NOT NULL DEFAULT 0,
				added_rows INTEGER NOT NULL DEFAULT 0,
				deleted_rows INTEGER NOT NULL DEFAULT 0,
				changed_rows INTEGER NOT NULL DEFAULT 0,
				changed_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
				sample_added JSONB NOT NULL DEFAULT '[]'::jsonb,
				sample_deleted JSONB NOT NULL DEFAULT '[]'::jsonb,
				autosave_count INTEGER NOT NULL DEFAULT 1,
				summary TEXT NOT NULL,
				href TEXT NULL,
				csv_content TEXT NULL
			)
		`;

		await this.sql`
			ALTER TABLE app_event_sheet_revisions
			ADD COLUMN IF NOT EXISTS csv_content TEXT NULL
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_sheet_revisions_updated_at
			ON app_event_sheet_revisions (updated_at DESC, id DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_sheet_revisions_trigger
			ON app_event_sheet_revisions (trigger, updated_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_sheet_revisions_actor_session
			ON app_event_sheet_revisions (actor_session_jti, updated_at DESC)
			WHERE actor_session_jti IS NOT NULL
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	private async insertRevision(
		input: EventSheetRevisionInput,
		groupId = randomUUID(),
	): Promise<EventSheetRevisionRecord> {
		const id = randomUUID();
		const rows = await this.sql<EventSheetRevisionRow[]>`
			INSERT INTO app_event_sheet_revisions (
				id,
				group_id,
				trigger,
				actor_label,
				actor_session_jti,
				row_count,
				column_count,
				added_rows,
				deleted_rows,
				changed_rows,
				changed_columns,
				sample_added,
				sample_deleted,
				autosave_count,
				summary,
				href,
				csv_content
			)
			VALUES (
				${id},
				${groupId},
				${input.trigger},
				${input.actorLabel},
				${input.actorSessionJti},
				${input.rowCount},
				${input.columnCount},
				${input.addedRows},
				${input.deletedRows},
				${input.changedRows},
				${this.sql.json(input.changedColumns)},
				${this.sql.json(input.sampleAdded)},
				${this.sql.json(input.sampleDeleted)},
				1,
				${input.summary || formatSummary(input.trigger, input)},
				${input.href ?? null},
				${input.csvContent}
			)
			RETURNING *
		`;

		const revision = rows[0];
		if (!revision) {
			throw new Error("Failed to record event sheet revision");
		}

		return toRecord(revision);
	}

	async createPublish(
		input: EventSheetRevisionInput,
	): Promise<EventSheetRevisionRecord> {
		await this.ready();
		return this.insertRevision({ ...input, trigger: "publish" });
	}

	async upsertAutosave(
		input: EventSheetRevisionInput,
	): Promise<EventSheetRevisionRecord> {
		await this.ready();
		const recentRows = input.actorSessionJti
			? await this.sql<EventSheetRevisionRow[]>`
					SELECT *
					FROM app_event_sheet_revisions
					WHERE trigger = 'autosave'
						AND actor_session_jti = ${input.actorSessionJti}
						AND updated_at >= NOW() - INTERVAL '10 minutes'
					ORDER BY updated_at DESC, id DESC
					LIMIT 1
				`
			: await this.sql<EventSheetRevisionRow[]>`
					SELECT *
					FROM app_event_sheet_revisions
					WHERE trigger = 'autosave'
						AND actor_session_jti IS NULL
						AND actor_label = ${input.actorLabel}
						AND updated_at >= NOW() - INTERVAL '10 minutes'
					ORDER BY updated_at DESC, id DESC
					LIMIT 1
				`;

		const recent = recentRows[0];
		if (!recent) {
			return this.insertRevision({ ...input, trigger: "autosave" });
		}

		const changedColumns = uniqueStrings(
			[...toStringArray(recent.changed_columns), ...input.changedColumns],
			16,
		);
		const sampleAdded = uniqueStrings(
			[...toStringArray(recent.sample_added), ...input.sampleAdded],
			6,
		);
		const sampleDeleted = uniqueStrings(
			[...toStringArray(recent.sample_deleted), ...input.sampleDeleted],
			6,
		);
		const addedRows = recent.added_rows + input.addedRows;
		const deletedRows = recent.deleted_rows + input.deletedRows;
		const changedRows = Math.max(recent.changed_rows, input.changedRows);
		const summary = formatSummary("autosave", {
			...input,
			addedRows,
			deletedRows,
			changedRows,
		});

		const rows = await this.sql<EventSheetRevisionRow[]>`
			UPDATE app_event_sheet_revisions
			SET
				updated_at = NOW(),
				row_count = ${input.rowCount},
				column_count = ${input.columnCount},
				added_rows = ${addedRows},
				deleted_rows = ${deletedRows},
				changed_rows = ${changedRows},
				changed_columns = ${this.sql.json(changedColumns)},
				sample_added = ${this.sql.json(sampleAdded)},
				sample_deleted = ${this.sql.json(sampleDeleted)},
				autosave_count = autosave_count + 1,
				summary = ${summary},
				href = ${input.href ?? recent.href},
				csv_content = ${input.csvContent}
			WHERE id = ${recent.id}
			RETURNING *
		`;

		const revision = rows[0];
		if (!revision) {
			throw new Error("Failed to update event sheet autosave revision");
		}

		return toRecord(revision);
	}

	async listRecent(limit = 20): Promise<EventSheetRevisionRecord[]> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(limit, 80));
		const rows = await this.sql<EventSheetRevisionRow[]>`
			SELECT
				id,
				group_id,
				trigger,
				created_at,
				updated_at,
				actor_label,
				actor_session_jti,
				row_count,
				column_count,
				added_rows,
				deleted_rows,
				changed_rows,
				changed_columns,
				sample_added,
				sample_deleted,
				autosave_count,
				summary,
				href,
				CASE WHEN csv_content IS NULL THEN NULL ELSE 'available' END AS csv_content
			FROM app_event_sheet_revisions
			ORDER BY updated_at DESC, id DESC
			LIMIT ${safeLimit}
		`;

		return rows.map(toRecord);
	}

	async getSnapshotById(
		id: string,
	): Promise<EventSheetRevisionSnapshot | null> {
		await this.ready();
		const rows = await this.sql<EventSheetRevisionRow[]>`
			SELECT *
			FROM app_event_sheet_revisions
			WHERE id = ${id}
			LIMIT 1
		`;

		const row = rows[0];
		if (!row?.csv_content) return null;

		return {
			revision: toRecord(row),
			csvContent: row.csv_content,
		};
	}
}

export const getEventSheetRevisionRepository =
	(): EventSheetRevisionRepository | null => {
		const sql = getPostgresClient();
		if (!sql) return null;

		if (!globalThis.__ooocFeteFinderEventSheetRevisionRepository) {
			globalThis.__ooocFeteFinderEventSheetRevisionRepository =
				new EventSheetRevisionRepository(sql);
		}

		return globalThis.__ooocFeteFinderEventSheetRevisionRepository;
	};
