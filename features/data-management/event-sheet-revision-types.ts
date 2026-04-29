export type EventSheetRevisionTrigger = "autosave" | "publish";

export interface EventSheetRevisionChangeSummary {
	addedRows: number;
	deletedRows: number;
	changedRows: number;
	changedColumns: string[];
	sampleAdded: string[];
	sampleDeleted: string[];
}

export interface EventSheetRevisionRecord
	extends EventSheetRevisionChangeSummary {
	id: string;
	groupId: string;
	trigger: EventSheetRevisionTrigger;
	createdAt: string;
	updatedAt: string;
	actorLabel: string;
	actorSessionJti: string | null;
	rowCount: number;
	columnCount: number;
	autosaveCount: number;
	summary: string;
	href: string | null;
	canRestore: boolean;
}

export interface EventSheetRevisionInput
	extends EventSheetRevisionChangeSummary {
	trigger: EventSheetRevisionTrigger;
	actorLabel: string;
	actorSessionJti: string | null;
	rowCount: number;
	columnCount: number;
	summary: string;
	csvContent: string;
	href?: string | null;
}

export interface EventSheetRevisionSnapshot {
	revision: EventSheetRevisionRecord;
	csvContent: string;
}
