export type EventStoreBackupTrigger = "cron" | "manual" | "pre-restore";

export interface EventStoreBackupSummary {
	id: string;
	createdAt: string;
	createdBy: string;
	trigger: EventStoreBackupTrigger;
	rowCount: number;
	featuredEntryCount: number;
	storeUpdatedAt: string | null;
	storeChecksum: string;
}

export interface EventStoreBackupStatus {
	backupCount: number;
	latestBackup: EventStoreBackupSummary | null;
}
