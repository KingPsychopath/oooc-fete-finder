import "server-only";

import { createHash } from "crypto";
import {
	getEventSheetStoreRepository,
} from "@/lib/platform/postgres/event-sheet-store-repository";
import { getEventStoreBackupRepository } from "@/lib/platform/postgres/event-store-backup-repository";
import { LocalEventStore } from "./local-event-store";
import type {
	EventStoreBackupStatus,
	EventStoreBackupSummary,
	EventStoreBackupTrigger,
} from "./event-store-backup-types";

const BACKUP_RETENTION_LIMIT = 30;
const UNSUPPORTED_REASON =
	"Event store backups require a configured Postgres DATABASE_URL.";

const normalizeCsv = (csvContent: string): string =>
	csvContent.replace(/\r\n/g, "\n").trim();

const buildChecksum = (csvContent: string): string =>
	createHash("sha256").update(csvContent).digest("hex").slice(0, 16);

type BackupResult = {
	success: boolean;
	message: string;
	backup?: EventStoreBackupSummary;
	prunedCount?: number;
	noData?: boolean;
	unsupported?: boolean;
	error?: string;
};

type RestoreResult = {
	success: boolean;
	message: string;
	restoredFrom?: EventStoreBackupSummary;
	preRestoreBackup?: EventStoreBackupSummary;
	restoredRowCount?: number;
	restoredCsv?: string;
	unsupported?: boolean;
	error?: string;
};

export class EventStoreBackupService {
	static async getBackupStatus(): Promise<
		| {
			supported: true;
			status: EventStoreBackupStatus;
		}
		| {
			supported: false;
			reason: string;
		}
	> {
		const repository = getEventStoreBackupRepository();
		if (!repository) {
			return {
				supported: false,
				reason: UNSUPPORTED_REASON,
			};
		}

		return {
			supported: true,
			status: await repository.getBackupStatus(),
		};
	}

	static async createBackup(input: {
		createdBy: string;
		trigger: EventStoreBackupTrigger;
	}): Promise<BackupResult> {
		const repository = getEventStoreBackupRepository();
		const eventStoreRepository = getEventSheetStoreRepository();
		if (!repository || !eventStoreRepository) {
			return {
				success: false,
				message: UNSUPPORTED_REASON,
				unsupported: true,
			};
		}

		try {
			const csv = await LocalEventStore.getCsv();
			const normalizedCsv = normalizeCsv(csv || "");
			if (!normalizedCsv) {
				return {
					success: false,
					message: "Managed store has no rows to back up yet.",
					noData: true,
				};
			}

			const storeMeta = await eventStoreRepository.getMeta();
			const backup = await repository.createBackup({
				createdBy: input.createdBy,
				trigger: input.trigger,
				rowCount: storeMeta.rowCount,
				storeUpdatedAt: storeMeta.updatedAt,
				storeChecksum: storeMeta.checksum || buildChecksum(normalizedCsv),
				csvContent: normalizedCsv,
			});
			const prunedCount = await repository.pruneOldBackups(BACKUP_RETENTION_LIMIT);

			return {
				success: true,
				message: `Backup created (${backup.rowCount} rows)`,
				backup,
				prunedCount,
			};
		} catch (error) {
			return {
				success: false,
				message: "Failed to create event store backup",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	static async restoreLatestBackup(input: {
		createdBy: string;
	}): Promise<RestoreResult> {
		const repository = getEventStoreBackupRepository();
		const eventStoreRepository = getEventSheetStoreRepository();
		if (!repository || !eventStoreRepository) {
			return {
				success: false,
				message: UNSUPPORTED_REASON,
				unsupported: true,
			};
		}

		try {
			const latest = await repository.getLatestBackup();
			if (!latest) {
				return {
					success: false,
					message: "No event store backup exists yet.",
				};
			}

			const currentCsv = normalizeCsv((await LocalEventStore.getCsv()) || "");
			let preRestoreBackup: EventStoreBackupSummary | undefined;
			if (currentCsv) {
				const currentMeta = await eventStoreRepository.getMeta();
				preRestoreBackup = await repository.createBackup({
					createdBy: input.createdBy,
					trigger: "pre-restore",
					rowCount: currentMeta.rowCount,
					storeUpdatedAt: currentMeta.updatedAt,
					storeChecksum: currentMeta.checksum || buildChecksum(currentCsv),
					csvContent: currentCsv,
				});
				await repository.pruneOldBackups(BACKUP_RETENTION_LIMIT);
			}

			const restoredCsv = normalizeCsv(latest.csvContent);
			const restoredMeta = await LocalEventStore.saveCsv(restoredCsv, {
				updatedBy: input.createdBy,
				origin: "manual",
			});

			return {
				success: true,
				message: `Restored latest backup from ${new Date(latest.createdAt).toLocaleString()}`,
				restoredFrom: {
					id: latest.id,
					createdAt: latest.createdAt,
					createdBy: latest.createdBy,
					trigger: latest.trigger,
					rowCount: latest.rowCount,
					storeUpdatedAt: latest.storeUpdatedAt,
					storeChecksum: latest.storeChecksum,
				},
				preRestoreBackup,
				restoredRowCount: restoredMeta.rowCount,
				restoredCsv,
			};
		} catch (error) {
			return {
				success: false,
				message: "Failed to restore latest event store backup",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}
