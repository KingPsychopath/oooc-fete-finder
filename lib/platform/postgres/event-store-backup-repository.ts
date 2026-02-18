import "server-only";

import { randomUUID } from "crypto";
import type { Sql } from "postgres";
import type {
	EventStoreBackupStatus,
	EventStoreBackupSummary,
} from "@/features/data-management/event-store-backup-types";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderEventStoreBackupRepository:
		| EventStoreBackupRepository
		| undefined;
}

const toIsoString = (value: Date | string | null): string | null => {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

export class EventStoreBackupRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_event_store_backups (
				id TEXT PRIMARY KEY,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				created_by TEXT NOT NULL,
				trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual', 'pre-restore')),
				row_count INTEGER NOT NULL,
				store_updated_at TIMESTAMPTZ NULL,
				store_checksum TEXT NOT NULL,
				csv_content TEXT NOT NULL
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_event_store_backups_created_at_desc
			ON app_event_store_backups (created_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	private mapBackup(
		row: {
			id: string;
			created_at: Date | string;
			created_by: string;
			trigger: "cron" | "manual" | "pre-restore";
			row_count: number;
			store_updated_at: Date | string | null;
			store_checksum: string;
		},
	): EventStoreBackupSummary {
		return {
			id: row.id,
			createdAt: toIsoString(row.created_at) || new Date(0).toISOString(),
			createdBy: row.created_by,
			trigger: row.trigger,
			rowCount: row.row_count,
			storeUpdatedAt: toIsoString(row.store_updated_at),
			storeChecksum: row.store_checksum,
		};
	}

	async createBackup(input: {
		createdBy: string;
		trigger: "cron" | "manual" | "pre-restore";
		rowCount: number;
		storeUpdatedAt: string | null;
		storeChecksum: string;
		csvContent: string;
	}): Promise<EventStoreBackupSummary> {
		await this.ready();

		const id = randomUUID();
		const rows = await this.sql<
			{
				id: string;
				created_at: Date | string;
				created_by: string;
				trigger: "cron" | "manual" | "pre-restore";
				row_count: number;
				store_updated_at: Date | string | null;
				store_checksum: string;
			}[]
		>`
			INSERT INTO app_event_store_backups (
				id,
				created_by,
				trigger,
				row_count,
				store_updated_at,
				store_checksum,
				csv_content
			)
			VALUES (
				${id},
				${input.createdBy},
				${input.trigger},
				${Math.max(0, input.rowCount)},
				${input.storeUpdatedAt},
				${input.storeChecksum},
				${input.csvContent}
			)
			RETURNING
				id,
				created_at,
				created_by,
				trigger,
				row_count,
				store_updated_at,
				store_checksum
		`;

		const record = rows[0];
		if (!record) {
			throw new Error("Failed to create event store backup");
		}

		return this.mapBackup(record);
	}

	async getLatestBackup(): Promise<
		(EventStoreBackupSummary & { csvContent: string }) | null
	> {
		await this.ready();
		const rows = await this.sql<
			{
				id: string;
				created_at: Date | string;
				created_by: string;
				trigger: "cron" | "manual" | "pre-restore";
				row_count: number;
				store_updated_at: Date | string | null;
				store_checksum: string;
				csv_content: string;
			}[]
		>`
			SELECT
				id,
				created_at,
				created_by,
				trigger,
				row_count,
				store_updated_at,
				store_checksum,
				csv_content
			FROM app_event_store_backups
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		`;

		const record = rows[0];
		if (!record) return null;

		return {
			...this.mapBackup(record),
			csvContent: record.csv_content,
		};
	}

	async pruneOldBackups(keepCount: number): Promise<number> {
		await this.ready();
		const normalizedKeepCount = Math.max(0, Math.floor(keepCount));
		const rows = await this.sql<{ count: number }[]>`
			WITH stale AS (
				SELECT id
				FROM app_event_store_backups
				ORDER BY created_at DESC, id DESC
				OFFSET ${normalizedKeepCount}
			),
			deleted AS (
				DELETE FROM app_event_store_backups
				WHERE id IN (SELECT id FROM stale)
				RETURNING id
			)
			SELECT COUNT(*)::int AS count
			FROM deleted
		`;

		return rows[0]?.count ?? 0;
	}

	async getBackupStatus(): Promise<EventStoreBackupStatus> {
		await this.ready();
		const [latest, countRows] = await Promise.all([
			this.getLatestBackup(),
			this.sql<{ count: number }[]>`
				SELECT COUNT(*)::int AS count
				FROM app_event_store_backups
			`,
		]);

		return {
			backupCount: countRows[0]?.count ?? 0,
			latestBackup:
				latest ?
					{
						id: latest.id,
						createdAt: latest.createdAt,
						createdBy: latest.createdBy,
						trigger: latest.trigger,
						rowCount: latest.rowCount,
						storeUpdatedAt: latest.storeUpdatedAt,
						storeChecksum: latest.storeChecksum,
					}
				: null,
		};
	}
}

export const getEventStoreBackupRepository = (): EventStoreBackupRepository | null => {
	const sql = getPostgresClient();
	if (!sql) return null;

	if (!globalThis.__ooocFeteFinderEventStoreBackupRepository) {
		globalThis.__ooocFeteFinderEventStoreBackupRepository =
			new EventStoreBackupRepository(sql);
	}

	return globalThis.__ooocFeteFinderEventStoreBackupRepository;
};
