import "server-only";

import { createHash } from "crypto";
import {
	getEventSheetStoreRepository,
} from "@/lib/platform/postgres/event-sheet-store-repository";
import { getEventStoreBackupRepository } from "@/lib/platform/postgres/event-store-backup-repository";
import { getFeaturedEventRepository } from "@/lib/platform/postgres/featured-event-repository";
import type { FeaturedScheduleEntry } from "@/features/events/featured/types";
import { LocalEventStore } from "./local-event-store";
import type {
	EventStoreBackupStatus,
	EventStoreBackupSummary,
	EventStoreBackupTrigger,
} from "./event-store-backup-types";

const BACKUP_RETENTION_LIMIT = 30;
const UNSUPPORTED_REASON =
	"Event/featured backups require a configured Postgres DATABASE_URL.";

const normalizeCsv = (csvContent: string): string =>
	csvContent.replace(/\r\n/g, "\n").trim();

const buildChecksum = (csvContent: string): string =>
	createHash("sha256").update(csvContent).digest("hex").slice(0, 16);

const isFeaturedStatus = (
	value: unknown,
): value is FeaturedScheduleEntry["status"] => {
	return value === "scheduled" || value === "cancelled" || value === "completed";
};

const parseFeaturedEntriesJson = (value: string): FeaturedScheduleEntry[] => {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];

		return parsed
			.map((entry): FeaturedScheduleEntry | null => {
				if (!entry || typeof entry !== "object") return null;
				const candidate = entry as Record<string, unknown>;
				if (
					typeof candidate.id !== "string" ||
					typeof candidate.eventKey !== "string" ||
					typeof candidate.requestedStartAt !== "string" ||
					typeof candidate.effectiveStartAt !== "string" ||
					typeof candidate.effectiveEndAt !== "string" ||
					typeof candidate.durationHours !== "number" ||
					!isFeaturedStatus(candidate.status) ||
					typeof candidate.createdBy !== "string" ||
					typeof candidate.createdAt !== "string" ||
					typeof candidate.updatedAt !== "string"
				) {
					return null;
				}

				return {
					id: candidate.id,
					eventKey: candidate.eventKey,
					requestedStartAt: candidate.requestedStartAt,
					effectiveStartAt: candidate.effectiveStartAt,
					effectiveEndAt: candidate.effectiveEndAt,
					durationHours: candidate.durationHours,
					status: candidate.status,
					createdBy: candidate.createdBy,
					createdAt: candidate.createdAt,
					updatedAt: candidate.updatedAt,
				};
			})
			.filter((entry): entry is FeaturedScheduleEntry => Boolean(entry));
	} catch {
		return [];
	}
};

const stringifyFeaturedEntries = (entries: FeaturedScheduleEntry[]): string =>
	JSON.stringify(entries);

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
	restoredFeaturedCount?: number;
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

	static async listRecentBackups(limit = 10): Promise<
		| { supported: true; backups: EventStoreBackupSummary[] }
		| { supported: false; reason: string }
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
			backups: await repository.listBackups(limit),
		};
	}

	static async createBackup(input: {
		createdBy: string;
		trigger: EventStoreBackupTrigger;
	}): Promise<BackupResult> {
		const repository = getEventStoreBackupRepository();
		const eventStoreRepository = getEventSheetStoreRepository();
		const featuredRepository = getFeaturedEventRepository();
		if (!repository || !eventStoreRepository || !featuredRepository) {
			return {
				success: false,
				message: UNSUPPORTED_REASON,
				unsupported: true,
			};
		}

		try {
			const [csvRaw, featuredEntries, storeMeta] = await Promise.all([
				LocalEventStore.getCsv(),
				featuredRepository.withScheduleLock((session) => session.listEntries()),
				eventStoreRepository.getMeta(),
			]);
			const normalizedCsv = normalizeCsv(csvRaw || "");
			if (!normalizedCsv && featuredEntries.length === 0) {
				return {
					success: false,
					message: "Managed store and featured schedule are both empty; nothing to back up.",
					noData: true,
				};
			}

			const backup = await repository.createBackup({
				createdBy: input.createdBy,
				trigger: input.trigger,
				rowCount: normalizedCsv ? storeMeta.rowCount : 0,
				featuredEntryCount: featuredEntries.length,
				storeUpdatedAt: normalizedCsv ? storeMeta.updatedAt : null,
				storeChecksum:
					normalizedCsv ?
						(storeMeta.checksum || buildChecksum(normalizedCsv))
					: "",
				csvContent: normalizedCsv,
				featuredEntriesJson: stringifyFeaturedEntries(featuredEntries),
			});
			const prunedCount = await repository.pruneOldBackups(BACKUP_RETENTION_LIMIT);

			return {
				success: true,
				message: `Backup created (${backup.rowCount} rows, ${backup.featuredEntryCount} featured entries)`,
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

	static async restoreBackup(input: {
		createdBy: string;
		backupId?: string;
	}): Promise<RestoreResult> {
		const repository = getEventStoreBackupRepository();
		const eventStoreRepository = getEventSheetStoreRepository();
		const featuredRepository = getFeaturedEventRepository();
		if (!repository || !eventStoreRepository || !featuredRepository) {
			return {
				success: false,
				message: UNSUPPORTED_REASON,
				unsupported: true,
			};
		}

		try {
			const targetBackup =
				input.backupId ?
					await repository.getBackupById(input.backupId)
				: 	await repository.getLatestBackup();
			if (!targetBackup) {
				return {
					success: false,
					message: "No matching event store backup exists.",
				};
			}

			const [currentCsvRaw, currentFeaturedEntries, currentMeta] = await Promise.all([
				LocalEventStore.getCsv(),
				featuredRepository.withScheduleLock((session) => session.listEntries()),
				eventStoreRepository.getMeta(),
			]);
			const currentCsv = normalizeCsv(currentCsvRaw || "");
			let preRestoreBackup: EventStoreBackupSummary | undefined;
			if (currentCsv || currentFeaturedEntries.length > 0) {
				preRestoreBackup = await repository.createBackup({
					createdBy: input.createdBy,
					trigger: "pre-restore",
					rowCount: currentCsv ? currentMeta.rowCount : 0,
					featuredEntryCount: currentFeaturedEntries.length,
					storeUpdatedAt: currentCsv ? currentMeta.updatedAt : null,
					storeChecksum:
						currentCsv ?
							(currentMeta.checksum || buildChecksum(currentCsv))
						: "",
					csvContent: currentCsv,
					featuredEntriesJson: stringifyFeaturedEntries(currentFeaturedEntries),
				});
				await repository.pruneOldBackups(BACKUP_RETENTION_LIMIT);
			}

			const restoredCsv = normalizeCsv(targetBackup.csvContent || "");
			const restoredRowCount =
				restoredCsv ?
					(await LocalEventStore.saveCsv(restoredCsv, {
						updatedBy: input.createdBy,
						origin: "manual",
					})).rowCount
				: 	(await LocalEventStore.clearCsv(), 0);

			const restoredFeaturedEntries = parseFeaturedEntriesJson(
				targetBackup.featuredEntriesJson,
			);
			await featuredRepository.withScheduleLock(async (session) => {
				await session.replaceAllEntries(restoredFeaturedEntries);
			});

			return {
				success: true,
				message:
					input.backupId ?
						`Restored snapshot ${targetBackup.id}`
					: 	`Restored latest backup from ${new Date(targetBackup.createdAt).toLocaleString()}`,
				restoredFrom: {
					id: targetBackup.id,
					createdAt: targetBackup.createdAt,
					createdBy: targetBackup.createdBy,
					trigger: targetBackup.trigger,
					rowCount: targetBackup.rowCount,
					featuredEntryCount: targetBackup.featuredEntryCount,
					storeUpdatedAt: targetBackup.storeUpdatedAt,
					storeChecksum: targetBackup.storeChecksum,
				},
				preRestoreBackup,
				restoredRowCount,
				restoredFeaturedCount: restoredFeaturedEntries.length,
				restoredCsv,
			};
		} catch (error) {
			return {
				success: false,
				message: "Failed to restore event/featured backup",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	static async restoreLatestBackup(input: {
		createdBy: string;
	}): Promise<RestoreResult> {
		return this.restoreBackup({
			createdBy: input.createdBy,
		});
	}
}
