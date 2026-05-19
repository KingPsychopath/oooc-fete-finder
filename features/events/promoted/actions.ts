"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
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
			seriesKey: event.seriesKey ?? "",
			name: event.name,
			date: event.date,
			dateRangeStart: event.dateRangeStart ?? "",
			dateRangeEnd: event.dateRangeEnd ?? "",
			occurrenceIndex: event.occurrenceIndex ?? null,
			occurrenceCount: event.occurrenceCount ?? null,
			time: event.time || "",
		}));
};

const normalizeEventKeys = (eventKeys: readonly string[]): string[] => [
	...new Set(eventKeys.map((key) => key.trim()).filter(Boolean)),
];

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
		seriesKey: string;
		name: string;
		date: string;
		dateRangeStart: string;
		dateRangeEnd: string;
		occurrenceIndex: number | null;
		occurrenceCount: number | null;
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

export async function schedulePromotedEvents(
	eventKeys: readonly string[],
	requestedStartAt: string,
	durationHours?: number,
): Promise<{
	success: boolean;
	message: string;
	error?: string;
}> {
	try {
		await assertAdmin();
		const keys = normalizeEventKeys(eventKeys);
		if (keys.length === 0) {
			return { success: false, message: "Event key is required" };
		}
		const results = await Promise.allSettled(
			keys.map((eventKey) =>
				schedulePromotedEntry({
					eventKey,
					requestedStartAt,
					durationHours,
					createdBy: "admin-panel",
				}),
			),
		);
		const failedEventKeys = keys.filter(
			(_, index) => results[index]?.status === "rejected",
		);
		const scheduledEventKeys = keys.filter(
			(_, index) => results[index]?.status === "fulfilled",
		);
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.promoted.scheduled",
			category: "placements",
			targetType: "promoted_placement",
			targetId: scheduledEventKeys[0] ?? keys[0],
			targetLabel:
				scheduledEventKeys.length > 1
					? `${scheduledEventKeys.length} promoted occurrences`
					: (scheduledEventKeys[0] ?? keys[0]),
			summary:
				scheduledEventKeys.length > 1
					? `${scheduledEventKeys.length} promoted occurrences scheduled`
					: `Promoted placement scheduled for ${scheduledEventKeys[0] ?? keys[0]}`,
			metadata: {
				requestedStartAt,
				durationHours,
				eventKeys: scheduledEventKeys,
				failedEventKeys,
			},
			href: "/admin/placements#featured-events-manager",
		});
		if (failedEventKeys.length > 0) {
			return {
				success: false,
				message: `Scheduled ${scheduledEventKeys.length} of ${keys.length} promoted occurrence${keys.length === 1 ? "" : "s"}`,
				error: `${failedEventKeys.length} event(s) could not be scheduled`,
			};
		}
		return {
			success: true,
			message:
				scheduledEventKeys.length > 1
					? `Promoted schedule saved for ${scheduledEventKeys.length} occurrences and pages revalidated`
					: "Promoted schedule saved and pages revalidated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to schedule promoted event",
			error: error instanceof Error ? error.message : "Unknown schedule error",
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
	return schedulePromotedEvents([eventKey], requestedStartAt, durationHours);
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
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.promoted.cancelled",
			category: "placements",
			targetType: "promoted_placement",
			targetId: entryId,
			targetLabel: entryId,
			summary: "Promoted placement cancelled",
			severity: "warning",
			href: "/admin/placements#featured-events-manager",
		});
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
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.promoted.rescheduled",
			category: "placements",
			targetType: "promoted_placement",
			targetId: entryId,
			targetLabel: entryId,
			summary: "Promoted placement rescheduled",
			metadata: { requestedStartAt, durationHours },
			href: "/admin/placements#featured-events-manager",
		});
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
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.promoted.cleared_all",
			category: "placements",
			targetType: "promoted_queue",
			targetLabel: "Promoted queue and history",
			summary: `Cleared ${clearedCount} promoted queue/history entr${clearedCount === 1 ? "y" : "ies"}`,
			metadata: { clearedCount },
			severity: "destructive",
			href: "/admin/placements#featured-events-manager",
		});
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
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.promoted.cleared_queue",
			category: "placements",
			targetType: "promoted_queue",
			targetLabel: "Promoted scheduled queue",
			summary: `Cleared ${clearedCount} scheduled promoted entr${clearedCount === 1 ? "y" : "ies"}`,
			metadata: { clearedCount },
			severity: "destructive",
			href: "/admin/placements#featured-events-manager",
		});
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
		revalidateEventsPaths(["/", "/feature-event"], { scope: "placements" });
		await recordAdminActivity({
			action: "placement.promoted.cleared_history",
			category: "placements",
			targetType: "promoted_history",
			targetLabel: "Promoted history",
			summary: `Cleared ${clearedCount} promoted history entr${clearedCount === 1 ? "y" : "ies"}`,
			metadata: { clearedCount },
			severity: "destructive",
			href: "/admin/placements#featured-events-manager",
		});
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
