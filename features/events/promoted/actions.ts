"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import {
	getLiveEvents,
	revalidateEventsPaths,
} from "@/features/data-management/runtime-service";
import { toParisDateTimeLocalInput } from "@/features/events/featured/paris-time";
import {
	buildPromotedQueueItems,
	cancelPromotedEntry,
	clearPromotedHistoryOnly as clearPromotedHistoryOnlyService,
	clearPromotedQueueHistory as clearPromotedQueueHistoryService,
	clearPromotedQueueOnly as clearPromotedQueueOnlyService,
	formatPromotedDateTime,
	getPromotedSlotConfig,
	reschedulePromotedEntry,
	schedulePromotedEntry,
} from "./service";

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

const sortEventOptions = (
	events: Awaited<ReturnType<typeof getLiveEvents>>["data"],
) => {
	return [...events]
		.sort((left, right) => left.name.localeCompare(right.name))
		.map((event) => ({
			eventKey: event.eventKey,
			name: event.name,
			date: event.date,
			time: event.time || "",
		}));
};

export async function listPromotedQueue(): Promise<{
	success: boolean;
	slotConfig?: ReturnType<typeof getPromotedSlotConfig>;
	activeCount?: number;
	queue?: Array<{
		id: string;
		eventKey: string;
		eventName: string;
		requestedStartAt: string;
		requestedStartAtParis: string;
		requestedStartAtParisInput: string;
		effectiveStartAt: string;
		effectiveStartAtParis: string;
		effectiveEndAt: string;
		effectiveEndAtParis: string;
		durationHours: number;
		status: "scheduled" | "cancelled" | "completed";
		state: "active" | "upcoming" | "recent-ended" | "completed" | "cancelled";
	}>;
	events?: Array<{
		eventKey: string;
		name: string;
		date: string;
		time: string;
	}>;
	error?: string;
}> {
	try {
		await assertAdmin();
		const eventsResult = await getLiveEvents({
			includeFeaturedProjection: false,
			includeEngagementProjection: false,
		});
		if (!eventsResult.success) {
			return {
				success: false,
				error: eventsResult.error || "Failed to load live events",
			};
		}
		const queue = await buildPromotedQueueItems(eventsResult.data);
		return {
			success: true,
			slotConfig: queue.slotConfig,
			activeCount: queue.activeCount,
			queue: queue.items.map((item) => ({
				id: item.id,
				eventKey: item.eventKey,
				eventName: item.eventName,
				requestedStartAt: item.requestedStartAt,
				requestedStartAtParis: formatPromotedDateTime(item.requestedStartAt),
				requestedStartAtParisInput: toParisDateTimeLocalInput(
					new Date(item.requestedStartAt),
				),
				effectiveStartAt: item.effectiveStartAt,
				effectiveStartAtParis: formatPromotedDateTime(item.effectiveStartAt),
				effectiveEndAt: item.effectiveEndAt,
				effectiveEndAtParis: formatPromotedDateTime(item.effectiveEndAt),
				durationHours: item.durationHours,
				status: item.status,
				state: item.state,
			})),
			events: sortEventOptions(eventsResult.data),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown promoted queue error",
		};
	}
}

export async function schedulePromotedEvent(
	eventKey: string,
	requestedStartAt: string,
	durationHours?: number,
): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		if (!eventKey || eventKey.trim().length === 0) {
			return { success: false, message: "Event key is required" };
		}
		await schedulePromotedEntry({
			eventKey,
			requestedStartAt,
			durationHours,
			createdBy: "admin-panel",
		});
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: "Promoted schedule saved and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to schedule promoted event",
			error: error instanceof Error ? error.message : "Unknown schedule error",
		};
	}
}

export async function cancelPromotedSchedule(entryId: string): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const cancelled = await cancelPromotedEntry(entryId);
		if (!cancelled) {
			return { success: false, message: "Promoted entry not found" };
		}
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: "Promoted entry cancelled and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to cancel promoted entry",
			error: error instanceof Error ? error.message : "Unknown cancel error",
		};
	}
}

export async function reschedulePromotedEvent(
	entryId: string,
	requestedStartAt: string,
	durationHours?: number,
): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const updated = await reschedulePromotedEntry({
			id: entryId,
			requestedStartAt,
			durationHours,
		});
		if (!updated) {
			return { success: false, message: "Promoted entry not found" };
		}
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: "Promoted entry rescheduled and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to reschedule promoted entry",
			error:
				error instanceof Error ? error.message : "Unknown reschedule error",
		};
	}
}

export async function clearPromotedQueueHistory(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearPromotedQueueHistoryService();
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: `Cleared ${clearedCount} promoted queue/history entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear promoted queue/history",
			error: error instanceof Error ? error.message : "Unknown clear error",
		};
	}
}

export async function clearPromotedQueue(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearPromotedQueueOnlyService();
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: `Cleared ${clearedCount} scheduled promoted entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear promoted queue",
			error:
				error instanceof Error ? error.message : "Unknown clear queue error",
		};
	}
}

export async function clearPromotedHistory(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearPromotedHistoryOnlyService();
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: `Cleared ${clearedCount} promoted history entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear promoted history",
			error:
				error instanceof Error ? error.message : "Unknown clear history error",
		};
	}
}
