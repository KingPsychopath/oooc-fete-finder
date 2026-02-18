"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import {
	getLiveEvents,
	revalidateEventsPaths,
} from "@/features/data-management/runtime-service";
import { toParisDateTimeLocalInput } from "./paris-time";
import {
	buildFeaturedQueueItems,
	cancelFeaturedEntry,
	clearFeaturedHistoryOnly as clearFeaturedHistoryOnlyService,
	clearFeaturedQueueOnly as clearFeaturedQueueOnlyService,
	clearFeaturedQueueHistory as clearFeaturedQueueHistoryService,
	formatFeaturedDateTime,
	getFeatureSlotConfig,
	recomputeFeaturedQueue,
	rescheduleFeaturedEntry,
	scheduleFeaturedEntry,
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

export async function listFeaturedQueue(): Promise<{
	success: boolean;
	slotConfig?: ReturnType<typeof getFeatureSlotConfig>;
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
		queuePosition: number | null;
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
		await recomputeFeaturedQueue();
		const eventsResult = await getLiveEvents({
			includeFeaturedProjection: false,
		});
		if (!eventsResult.success) {
			return {
				success: false,
				error: eventsResult.error || "Failed to load live events",
			};
		}

		const queue = await buildFeaturedQueueItems(eventsResult.data);
		return {
			success: true,
			slotConfig: queue.slotConfig,
			activeCount: queue.activeCount,
			queue: queue.items.map((item) => ({
				id: item.id,
				eventKey: item.eventKey,
				eventName: item.eventName,
				requestedStartAt: item.requestedStartAt,
				requestedStartAtParis: formatFeaturedDateTime(item.requestedStartAt),
				requestedStartAtParisInput: toParisDateTimeLocalInput(
					new Date(item.requestedStartAt),
				),
				effectiveStartAt: item.effectiveStartAt,
				effectiveStartAtParis: formatFeaturedDateTime(item.effectiveStartAt),
				effectiveEndAt: item.effectiveEndAt,
				effectiveEndAtParis: formatFeaturedDateTime(item.effectiveEndAt),
				durationHours: item.durationHours,
				status: item.status,
				state: item.state,
				queuePosition: item.queuePosition,
			})),
			events: sortEventOptions(eventsResult.data),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown queue error",
		};
	}
}

export async function scheduleFeaturedEvent(
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

		await scheduleFeaturedEntry({
			eventKey,
			requestedStartAt,
			durationHours,
			createdBy: "admin-panel",
		});
		revalidateEventsPaths(["/", "/feature-event"]);

		return {
			success: true,
			message: "Featured schedule saved and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to schedule featured event",
			error: error instanceof Error ? error.message : "Unknown schedule error",
		};
	}
}

export async function cancelFeaturedSchedule(entryId: string): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const cancelled = await cancelFeaturedEntry(entryId);
		if (!cancelled) {
			return {
				success: false,
				message: "Featured entry not found",
			};
		}
		revalidateEventsPaths(["/", "/feature-event"]);

		return {
			success: true,
			message: "Featured entry cancelled and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to cancel featured entry",
			error: error instanceof Error ? error.message : "Unknown cancel error",
		};
	}
}

export async function rescheduleFeaturedEvent(
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
		const updated = await rescheduleFeaturedEntry({
			id: entryId,
			requestedStartAt,
			durationHours,
		});
		if (!updated) {
			return {
				success: false,
				message: "Featured entry not found",
			};
		}
		revalidateEventsPaths(["/", "/feature-event"]);

		return {
			success: true,
			message: "Featured entry rescheduled and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to reschedule featured entry",
			error:
				error instanceof Error ? error.message : "Unknown reschedule error",
		};
	}
}

export async function clearFeaturedQueueHistory(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearFeaturedQueueHistoryService();
		revalidateEventsPaths(["/", "/feature-event"]);

		return {
			success: true,
			message: `Cleared ${clearedCount} featured queue/history entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear featured queue/history",
			error: error instanceof Error ? error.message : "Unknown clear error",
		};
	}
}

export async function clearFeaturedQueue(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearFeaturedQueueOnlyService();
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: `Cleared ${clearedCount} scheduled queue entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear featured queue",
			error:
				error instanceof Error ? error.message : "Unknown clear queue error",
		};
	}
}

export async function clearFeaturedHistory(): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const clearedCount = await clearFeaturedHistoryOnlyService();
		revalidateEventsPaths(["/", "/feature-event"]);
		return {
			success: true,
			message: `Cleared ${clearedCount} history entr${clearedCount === 1 ? "y" : "ies"}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to clear featured history",
			error:
				error instanceof Error ? error.message : "Unknown clear history error",
		};
	}
}
