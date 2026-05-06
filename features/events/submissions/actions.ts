"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import {
	getEventSheetEditorData,
	saveEventSheetEditorRows,
} from "@/features/data-management/actions";
import {
	type EditableSheetColumn,
	type EditableSheetRow,
	createBlankEditableSheetRow,
} from "@/features/data-management/csv/sheet-editor";
import { revalidatePath } from "next/cache";
import { EventSubmissionSettingsStore } from "./settings-store";
import type { EventSubmissionSettingKey } from "./settings-store";
import {
	getEventSubmissionById,
	getEventSubmissionSnapshot,
	reviewEventSubmission,
} from "./store";
import type {
	EventSubmissionRecord,
	EventSubmissionSettings,
	EventSubmissionSettingsStatus,
	EventSubmissionSnapshot,
} from "./types";

const assertAdmin = async (keyOrToken?: string): Promise<void> => {
	const authorized = await validateAdminAccessFromServerContext(
		keyOrToken ?? null,
	);
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

const buildSubmissionNotes = (
	submission: EventSubmissionRecord,
): string | undefined => {
	const notes = submission.payload.notes?.trim() || "";
	return notes || undefined;
};

const getSubmissionPrimaryUrl = (submission: EventSubmissionRecord): string => {
	if (submission.payload.ticketLink) return submission.payload.ticketLink;
	if (submission.payload.submissionType === "event_update") return "";
	return submission.payload.proofLink;
};

const mapSubmissionToSheetRow = (
	submission: EventSubmissionRecord,
	columns: EditableSheetColumn[],
): EditableSheetRow => {
	const row = createBlankEditableSheetRow(columns);
	const notes = buildSubmissionNotes(submission);

	row.eventKey = "";
	row.curated = "";
	row.hostCountry = "";
	row.audienceCountry = "";
	row.title = submission.payload.eventName;
	row.date = submission.payload.date;
	row.startTime = submission.payload.startTime;
	row.endTime = submission.payload.endTime || "";
	row.location = submission.payload.location;
	row.districtArea = submission.payload.arrondissement || "";
	row.categories = submission.payload.genre || "";
	row.tags = "";
	row.price = submission.payload.price || "";
	row.primaryUrl = getSubmissionPrimaryUrl(submission);
	row.ageGuidance = submission.payload.age || "";
	row.setting = submission.payload.indoorOutdoor || "";
	row.notes = notes || "";

	return row;
};

const parseAcceptedEventKey = (
	rows: EditableSheetRow[],
	beforeLength: number,
): string | null => {
	const addedRow = rows[beforeLength];
	if (!addedRow) return null;
	const rawEventKey = addedRow.eventKey;
	if (typeof rawEventKey !== "string") return null;
	const normalized = rawEventKey.trim();
	return normalized.length > 0 ? normalized : null;
};

export async function getEventSubmissionsDashboard(
	keyOrToken?: string,
): Promise<
	| ({
			success: true;
			settings: EventSubmissionSettings;
			settingsStatus: EventSubmissionSettingsStatus;
	  } & EventSubmissionSnapshot)
	| {
			success: false;
			error: string;
	  }
> {
	try {
		await assertAdmin(keyOrToken);
		const [snapshot, settings, settingsStatus] = await Promise.all([
			getEventSubmissionSnapshot(120),
			EventSubmissionSettingsStore.getSettings(),
			EventSubmissionSettingsStore.getStatus(),
		]);
		return {
			success: true,
			...snapshot,
			settings,
			settingsStatus,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown submissions error",
		};
	}
}

export async function updateEventSubmissionEnabled(
	setting: EventSubmissionSettingKey,
	enabled: boolean,
	keyOrToken?: string,
): Promise<{
	success: boolean;
	settings?: EventSubmissionSettings;
	settingsStatus?: EventSubmissionSettingsStatus;
	message?: string;
	error?: string;
}> {
	try {
		await assertAdmin(keyOrToken);
		const settings = await EventSubmissionSettingsStore.updateEnabled(
			setting,
			enabled,
			"admin-panel",
		);
		const settingsStatus = await EventSubmissionSettingsStore.getStatus();
		revalidatePath("/");
		revalidatePath("/submit-event");
		const label =
			setting === "new_events" ? "new event submissions" : "update requests";
		const title =
			setting === "new_events" ? "New event submissions" : "Update requests";
		await recordAdminActivity({
			action: enabled
				? `submissions.${setting}.enabled`
				: `submissions.${setting}.disabled`,
			category: "settings",
			targetType: "event_submission_settings",
			targetLabel: title,
			summary: enabled ? `${title} opened` : `${title} closed`,
			severity: enabled ? "info" : "warning",
			href: "/admin/content#event-submissions",
		});
		return {
			success: true,
			settings,
			settingsStatus,
			message: enabled ? `${label} are now open` : `${label} are now closed`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown update error",
		};
	}
}

export async function declineEventSubmission(
	submissionId: string,
	reason: string,
	keyOrToken?: string,
): Promise<
	| {
			success: true;
			record: EventSubmissionRecord;
			message: string;
	  }
	| {
			success: false;
			error: string;
			message: string;
	  }
> {
	try {
		await assertAdmin(keyOrToken);
		const normalizedSubmissionId = submissionId.trim();
		const normalizedReason = reason.trim();
		if (!normalizedSubmissionId) {
			return {
				success: false,
				message: "Invalid submission",
				error: "Submission id is required",
			};
		}
		if (!normalizedReason) {
			return {
				success: false,
				message: "Decline reason is required",
				error: "Decline reason is required",
			};
		}

		const current = await getEventSubmissionById(normalizedSubmissionId);
		if (!current) {
			return {
				success: false,
				message: "Submission not found",
				error: "Submission not found",
			};
		}
		if (current.status !== "pending") {
			return {
				success: false,
				message: "Submission already reviewed",
				error: `Submission is already ${current.status}`,
			};
		}

		const reviewed = await reviewEventSubmission({
			id: normalizedSubmissionId,
			status: "declined",
			reviewReason: normalizedReason,
			reviewedBy: "admin-panel",
		});
		if (!reviewed) {
			return {
				success: false,
				message: "Submission review conflict",
				error: "Submission was already reviewed by another admin",
			};
		}
		await recordAdminActivity({
			action: "submission.declined",
			category: "content",
			targetType: "event_submission",
			targetId: reviewed.id,
			targetLabel: reviewed.payload.eventName,
			summary: `${reviewed.payload.eventName} submission declined`,
			metadata: { reason: normalizedReason },
			severity: "warning",
			href: "/admin/content#event-submissions",
		});

		return {
			success: true,
			record: reviewed,
			message: "Submission declined",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to decline submission",
			error: error instanceof Error ? error.message : "Unknown decline error",
		};
	}
}

export async function acceptEventSubmission(
	submissionId: string,
	keyOrToken?: string,
): Promise<
	| {
			success: true;
			record: EventSubmissionRecord;
			message: string;
	  }
	| {
			success: false;
			error: string;
			message: string;
	  }
> {
	try {
		await assertAdmin(keyOrToken);
		const normalizedSubmissionId = submissionId.trim();
		if (!normalizedSubmissionId) {
			return {
				success: false,
				message: "Invalid submission",
				error: "Submission id is required",
			};
		}

		const current = await getEventSubmissionById(normalizedSubmissionId);
		if (!current) {
			return {
				success: false,
				message: "Submission not found",
				error: "Submission not found",
			};
		}
		if (current.status !== "pending") {
			return {
				success: false,
				message: "Submission already reviewed",
				error: `Submission is already ${current.status}`,
			};
		}
		if (current.payload.submissionType === "event_update") {
			return {
				success: false,
				message: "Review this update manually",
				error:
					"Update requests are queued for admin consideration. Apply the changed fields in the event sheet, then decline or leave the request as a reference.",
			};
		}

		const editorData = await getEventSheetEditorData();
		if (!editorData.success || !editorData.columns || !editorData.rows) {
			return {
				success: false,
				message: "Failed to load event sheet",
				error: editorData.error || "Unable to load editor data",
			};
		}

		const nextRows = [
			...editorData.rows.map((row) => ({ ...row })),
			mapSubmissionToSheetRow(current, editorData.columns),
		];
		const saveResult = await saveEventSheetEditorRows(
			undefined,
			editorData.columns,
			nextRows,
			{
				revalidateHomepage: true,
			},
		);
		if (!saveResult.success) {
			return {
				success: false,
				message: "Failed to publish accepted submission",
				error: saveResult.error || saveResult.message,
			};
		}

		const acceptedEventKey = parseAcceptedEventKey(
			nextRows,
			editorData.rows.length,
		);
		const reviewed = await reviewEventSubmission({
			id: normalizedSubmissionId,
			status: "accepted",
			reviewReason: "accepted",
			acceptedEventKey,
			reviewedBy: "admin-panel",
		});
		if (!reviewed) {
			return {
				success: false,
				message: "Submission review conflict",
				error: "Submission was already reviewed by another admin",
			};
		}
		await recordAdminActivity({
			action: "submission.accepted",
			category: "content",
			targetType: "event_submission",
			targetId: reviewed.id,
			targetLabel: reviewed.payload.eventName,
			summary: `${reviewed.payload.eventName} submission accepted and published`,
			metadata: { acceptedEventKey },
			href: "/admin/content#event-submissions",
		});

		return {
			success: true,
			record: reviewed,
			message: "Submission accepted and published",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to accept submission",
			error: error instanceof Error ? error.message : "Unknown accept error",
		};
	}
}
