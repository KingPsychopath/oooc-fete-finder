import "server-only";

import { createHash } from "crypto";
import type { UserRecord } from "@/features/auth/types";
import { UserCollectionStore } from "@/features/auth/user-collection-store";
import type { FeaturedScheduleEntry } from "@/features/events/featured/types";
import type { PromotedScheduleEntry } from "@/features/events/promoted/types";
import { EventSubmissionSettingsStore } from "@/features/events/submissions/settings-store";
import {
	listAllEventSubmissions,
	replaceAllEventSubmissions,
} from "@/features/events/submissions/store";
import type {
	EventSubmissionRecord,
	EventSubmissionSettings,
} from "@/features/events/submissions/types";
import { SlidingBannerStore } from "@/features/site-settings/sliding-banner-store";
import type { SlidingBannerSettings } from "@/features/site-settings/types";
import { getEventSheetStoreRepository } from "@/lib/platform/postgres/event-sheet-store-repository";
import { getEventStoreBackupRepository } from "@/lib/platform/postgres/event-store-backup-repository";
import { getFeaturedEventRepository } from "@/lib/platform/postgres/featured-event-repository";
import {
	type PartnerActivationRecord,
	getPartnerActivationRepository,
} from "@/lib/platform/postgres/partner-activation-repository";
import { getPromotedEventRepository } from "@/lib/platform/postgres/promoted-event-repository";
import type {
	EventStoreBackupStatus,
	EventStoreBackupSummary,
	EventStoreBackupTrigger,
} from "./event-store-backup-types";
import { LocalEventStore } from "./local-event-store";

const BACKUP_RETENTION_LIMIT = 30;
const UNSUPPORTED_REASON =
	"Event, featured, and email backups require a configured Postgres DATABASE_URL.";

const normalizeCsv = (csvContent: string): string =>
	csvContent.replace(/\r\n/g, "\n").trim();

const buildChecksum = (csvContent: string): string =>
	createHash("sha256").update(csvContent).digest("hex").slice(0, 16);

const isFeaturedStatus = (
	value: unknown,
): value is FeaturedScheduleEntry["status"] => {
	return (
		value === "scheduled" || value === "cancelled" || value === "completed"
	);
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

const isUserRecord = (value: unknown): value is UserRecord => {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.firstName === "string" &&
		typeof candidate.lastName === "string" &&
		typeof candidate.email === "string" &&
		typeof candidate.timestamp === "string" &&
		typeof candidate.consent === "boolean" &&
		typeof candidate.source === "string"
	);
};

const parseUserCollectionJson = (value: string | null): UserRecord[] | null => {
	if (value === null) return null;
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isUserRecord);
	} catch {
		return [];
	}
};

const stringifyUserCollection = (users: UserRecord[]): string =>
	JSON.stringify(users);

interface OperationalBackupState {
	version: 1;
	promotedEntries: PromotedScheduleEntry[];
	eventSubmissions: EventSubmissionRecord[];
	partnerActivations: PartnerActivationRecord[];
	settings: {
		slidingBanner: SlidingBannerSettings;
		eventSubmissions: EventSubmissionSettings;
	};
}

const parseOperationalStateJson = (
	value: string | null,
): OperationalBackupState | null => {
	if (value === null) return null;
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!parsed || typeof parsed !== "object") return null;
		const candidate = parsed as Partial<OperationalBackupState>;
		if (candidate.version !== 1) return null;
		return {
			version: 1,
			promotedEntries: Array.isArray(candidate.promotedEntries)
				? candidate.promotedEntries
				: [],
			eventSubmissions: Array.isArray(candidate.eventSubmissions)
				? candidate.eventSubmissions
				: [],
			partnerActivations: Array.isArray(candidate.partnerActivations)
				? candidate.partnerActivations
				: [],
			settings: {
				slidingBanner: candidate.settings
					?.slidingBanner as SlidingBannerSettings,
				eventSubmissions: candidate.settings
					?.eventSubmissions as EventSubmissionSettings,
			},
		};
	} catch {
		return null;
	}
};

const stringifyOperationalState = (state: OperationalBackupState): string =>
	JSON.stringify(state);

const hasOperationalStateData = (state: OperationalBackupState): boolean => {
	return (
		state.promotedEntries.length > 0 ||
		state.eventSubmissions.length > 0 ||
		state.partnerActivations.length > 0 ||
		state.settings.slidingBanner.updatedAt !== new Date(0).toISOString() ||
		state.settings.eventSubmissions.updatedAt !== new Date(0).toISOString()
	);
};

const buildOperationalState = async (): Promise<OperationalBackupState> => {
	const promotedRepository = getPromotedEventRepository();
	const partnerRepository = getPartnerActivationRepository();
	const [
		promotedEntries,
		eventSubmissions,
		partnerActivations,
		slidingBanner,
		eventSubmissionSettings,
	] = await Promise.all([
		promotedRepository
			? promotedRepository.withScheduleLock((session) => session.listEntries())
			: [],
		listAllEventSubmissions(),
		partnerRepository ? partnerRepository.listAll() : [],
		SlidingBannerStore.getSettings(),
		EventSubmissionSettingsStore.getSettings(),
	]);

	return {
		version: 1,
		promotedEntries,
		eventSubmissions,
		partnerActivations,
		settings: {
			slidingBanner,
			eventSubmissions: eventSubmissionSettings,
		},
	};
};

const restoreOperationalState = async (
	state: OperationalBackupState | null,
): Promise<void> => {
	if (!state) return;
	const promotedRepository = getPromotedEventRepository();
	const partnerRepository = getPartnerActivationRepository();
	if (promotedRepository) {
		await promotedRepository.replaceAllEntries(state.promotedEntries);
	}
	await replaceAllEventSubmissions(state.eventSubmissions);
	if (partnerRepository) {
		await partnerRepository.replaceAll(state.partnerActivations);
	}
	await SlidingBannerStore.replaceSettings(state.settings.slidingBanner);
	await EventSubmissionSettingsStore.replaceSettings(
		state.settings.eventSubmissions,
	);
};

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
	restoredUserCollectionCount?: number | null;
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

	static async listRecentBackups(
		limit = 10,
	): Promise<
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
			const [
				csvRaw,
				featuredEntries,
				storeMeta,
				collectedUsers,
				operationalState,
			] = await Promise.all([
				LocalEventStore.getCsv(),
				featuredRepository.withScheduleLock((session) => session.listEntries()),
				eventStoreRepository.getMeta(),
				UserCollectionStore.listAll(),
				buildOperationalState(),
			]);
			const normalizedCsv = normalizeCsv(csvRaw || "");
			if (
				!normalizedCsv &&
				featuredEntries.length === 0 &&
				collectedUsers.length === 0 &&
				!hasOperationalStateData(operationalState)
			) {
				return {
					success: false,
					message:
						"Managed store, featured schedule, and collected emails are all empty; nothing to back up.",
					noData: true,
				};
			}

			const backup = await repository.createBackup({
				createdBy: input.createdBy,
				trigger: input.trigger,
				rowCount: normalizedCsv ? storeMeta.rowCount : 0,
				featuredEntryCount: featuredEntries.length,
				userCollectionCount: collectedUsers.length,
				storeUpdatedAt: normalizedCsv ? storeMeta.updatedAt : null,
				storeChecksum: normalizedCsv
					? storeMeta.checksum || buildChecksum(normalizedCsv)
					: "",
				csvContent: normalizedCsv,
				featuredEntriesJson: stringifyFeaturedEntries(featuredEntries),
				userCollectionJson: stringifyUserCollection(collectedUsers),
				operationalStateJson: stringifyOperationalState(operationalState),
			});
			const prunedCount = await repository.pruneOldBackups(
				BACKUP_RETENTION_LIMIT,
			);

			return {
				success: true,
				message: `Backup created (${backup.rowCount} rows, ${backup.featuredEntryCount ?? 0} featured entries, ${backup.userCollectionCount ?? 0} emails)`,
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
			const targetBackup = input.backupId
				? await repository.getBackupById(input.backupId)
				: await repository.getLatestBackup();
			if (!targetBackup) {
				return {
					success: false,
					message: "No matching event store backup exists.",
				};
			}

			const [
				currentCsvRaw,
				currentFeaturedEntries,
				currentMeta,
				currentCollectedUsers,
				currentOperationalState,
			] = await Promise.all([
				LocalEventStore.getCsv(),
				featuredRepository.withScheduleLock((session) => session.listEntries()),
				eventStoreRepository.getMeta(),
				UserCollectionStore.listAll(),
				buildOperationalState(),
			]);
			const currentCsv = normalizeCsv(currentCsvRaw || "");
			let preRestoreBackup: EventStoreBackupSummary | undefined;
			if (
				currentCsv ||
				currentFeaturedEntries.length > 0 ||
				currentCollectedUsers.length > 0
			) {
				preRestoreBackup = await repository.createBackup({
					createdBy: input.createdBy,
					trigger: "pre-restore",
					rowCount: currentCsv ? currentMeta.rowCount : 0,
					featuredEntryCount: currentFeaturedEntries.length,
					userCollectionCount: currentCollectedUsers.length,
					storeUpdatedAt: currentCsv ? currentMeta.updatedAt : null,
					storeChecksum: currentCsv
						? currentMeta.checksum || buildChecksum(currentCsv)
						: "",
					csvContent: currentCsv,
					featuredEntriesJson: stringifyFeaturedEntries(currentFeaturedEntries),
					userCollectionJson: stringifyUserCollection(currentCollectedUsers),
					operationalStateJson: stringifyOperationalState(
						currentOperationalState,
					),
				});
				await repository.pruneOldBackups(BACKUP_RETENTION_LIMIT);
			}

			const restoredCsv = normalizeCsv(targetBackup.csvContent || "");
			const restoredRowCount = restoredCsv
				? (
						await LocalEventStore.saveCsv(restoredCsv, {
							updatedBy: input.createdBy,
							origin: "manual",
						})
					).rowCount
				: (await LocalEventStore.clearCsv(), 0);

			const restoredFeaturedEntries = parseFeaturedEntriesJson(
				targetBackup.featuredEntriesJson,
			);
			await featuredRepository.withScheduleLock(async (session) => {
				await session.replaceAllEntries(restoredFeaturedEntries);
			});

			const restoredCollectedUsers = parseUserCollectionJson(
				targetBackup.userCollectionJson,
			);
			if (restoredCollectedUsers !== null) {
				await UserCollectionStore.clearAll();
				for (const user of restoredCollectedUsers) {
					await UserCollectionStore.addOrUpdate(user);
				}
			}
			const restoredOperationalState = parseOperationalStateJson(
				targetBackup.operationalStateJson,
			);
			await restoreOperationalState(restoredOperationalState);

			return {
				success: true,
				message: input.backupId
					? `Restored snapshot ${targetBackup.id}`
					: `Restored latest backup from ${new Date(targetBackup.createdAt).toLocaleString()}`,
				restoredFrom: {
					id: targetBackup.id,
					createdAt: targetBackup.createdAt,
					createdBy: targetBackup.createdBy,
					trigger: targetBackup.trigger,
					rowCount: targetBackup.rowCount,
					featuredEntryCount: targetBackup.featuredEntryCount,
					userCollectionCount: targetBackup.userCollectionCount,
					storeUpdatedAt: targetBackup.storeUpdatedAt,
					storeChecksum: targetBackup.storeChecksum,
				},
				preRestoreBackup,
				restoredRowCount,
				restoredFeaturedCount: restoredFeaturedEntries.length,
				restoredUserCollectionCount: restoredCollectedUsers?.length ?? null,
				restoredCsv,
			};
		} catch (error) {
			return {
				success: false,
				message: "Failed to restore event/featured/email backup",
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
